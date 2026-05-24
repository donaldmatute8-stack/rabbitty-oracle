const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const Redis = require('ioredis');

const app = express();
app.use(cors());
app.use(express.json());

// Config
const PORT = process.env.PORT || 8080;
const BUNZ_CONTRACT = process.env.BUNZ_CONTRACT || '0x8d0CC6dcD796e9B14bd25BA2A21291aa3Af39fcB';
const RPC_URL = process.env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY;

// Redis para rate limiting (usa REDIS_URL si está disponible)
const redis = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL)
  : new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379
    });

// Web3 setup
const provider = new ethers.JsonRpcProvider(RPC_URL);
const oracleWallet = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, provider) : null;

// Bunz contract ABI (solo funciones necesarias)
const BUNZ_ABI = [
  "function mintReward(address business, address user, uint256 purchaseAmount, bytes32 receiptHash)",
  "function isRegistered(address business) view returns (bool)",
  "function getBusinessCredit(address business) view returns (uint256 limit, uint256 used, uint256 remaining)",
  "function receiptUsed(bytes32 receiptHash) view returns (bool)"
];

const bunzContract = oracleWallet ? new ethers.Contract(BUNZ_CONTRACT, BUNZ_ABI, oracleWallet) : null;

// ============ ENDPOINTS ============

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    oracle: oracleWallet ? oracleWallet.address : 'not configured',
    contract: BUNZ_CONTRACT,
    network: 'sepolia'
  });
});

// Generar QR para transacción
app.post('/generate-qr', async (req, res) => {
  const { businessAddress, amount } = req.body;
  
  if (!businessAddress || !amount) {
    return res.status(400).json({ error: 'Missing businessAddress or amount' });
  }
  
  // Verificar que el negocio está registrado
  try {
    const isRegistered = await bunzContract.isRegistered(businessAddress);
    if (!isRegistered) {
      return res.status(400).json({ error: 'Business not registered' });
    }
    
    // Generar QR único
    const timestamp = Date.now();
    const nonce = Math.random().toString(36).substring(2, 15);
    const receiptHash = ethers.keccak256(
      ethers.toUtf8Bytes(`${businessAddress}-${amount}-${timestamp}-${nonce}`)
    );
    
    // Guardar en Redis (expira en 5 minutos)
    await redis.setex(`qr:${receiptHash}`, 300, JSON.stringify({
      businessAddress,
      amount,
      timestamp,
      status: 'pending'
    }));
    
    res.json({
      receiptHash,
      qrData: {
        business: businessAddress,
        amount,
        hash: receiptHash,
        timestamp,
        expiresIn: 300
      }
    });
  } catch (error) {
    console.error('Error generating QR:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verificar y procesar consumo (llamado por app del negocio)
app.post('/process-consumption', async (req, res) => {
  const { businessAddress, userAddress, purchaseAmount, receiptHash, signature } = req.body;
  
  if (!businessAddress || !userAddress || !purchaseAmount || !receiptHash) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    // Rate limiting: max 100 transacciones por hora por negocio
    const rateKey = `ratelimit:${businessAddress}`;
    const currentCount = await redis.get(rateKey) || 0;
    if (parseInt(currentCount) >= 100) {
      return res.status(429).json({ error: 'Rate limit exceeded: max 100 transactions/hour' });
    }
    
    // Verificar que el QR existe y es válido
    const qrData = await redis.get(`qr:${receiptHash}`);
    if (!qrData) {
      return res.status(400).json({ error: 'Invalid or expired QR code' });
    }
    
    const parsedQr = JSON.parse(qrData);
    if (parsedQr.status !== 'pending') {
      return res.status(400).json({ error: 'Transaction already processed' });
    }
    
    if (parsedQr.businessAddress.toLowerCase() !== businessAddress.toLowerCase()) {
      return res.status(400).json({ error: 'Business address mismatch' });
    }
    
    // Verificar que el receiptHash no fue usado (en blockchain)
    const isUsed = await bunzContract.receiptUsed(receiptHash);
    if (isUsed) {
      return res.status(400).json({ error: 'Receipt already used on blockchain' });
    }
    
    // Procesar minting en blockchain
    const tx = await bunzContract.mintReward(
      businessAddress,
      userAddress,
      ethers.parseEther(purchaseAmount.toString()),
      receiptHash
    );
    
    await tx.wait();
    
    // Marcar como procesado
    await redis.setex(`qr:${receiptHash}`, 3600, JSON.stringify({
      ...parsedQr,
      status: 'completed',
      userAddress,
      txHash: tx.hash,
      processedAt: Date.now()
    }));
    
    // Incrementar rate limit
    await redis.incr(rateKey);
    await redis.expire(rateKey, 3600);
    
    res.json({
      success: true,
      txHash: tx.hash,
      receiptHash,
      message: 'Reward minted successfully'
    });
    
  } catch (error) {
    console.error('Error processing consumption:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verificar estado de transacción
app.get('/transaction/:receiptHash', async (req, res) => {
  const { receiptHash } = req.params;
  
  try {
    const qrData = await redis.get(`qr:${receiptHash}`);
    if (!qrData) {
      return res.json({ status: 'not_found' });
    }
    
    const parsed = JSON.parse(qrData);
    res.json({
      receiptHash,
      status: parsed.status,
      businessAddress: parsed.businessAddress,
      amount: parsed.amount,
      userAddress: parsed.userAddress,
      txHash: parsed.txHash,
      timestamp: parsed.timestamp,
      processedAt: parsed.processedAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verificar crédito de negocio
app.get('/business/:address/credit', async (req, res) => {
  const { address } = req.params;
  
  try {
    const credit = await bunzContract.getBusinessCredit(address);
    res.json({
      businessAddress: address,
      creditLimit: ethers.formatEther(credit.limit),
      creditUsed: ethers.formatEther(credit.used),
      creditRemaining: ethers.formatEther(credit.remaining)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Oracle Backend running on port ${PORT}`);
  console.log(`📡 Connected to: ${RPC_URL}`);
  console.log(`📝 Bunz Contract: ${BUNZ_CONTRACT}`);
  console.log(`🔑 Oracle: ${oracleWallet ? oracleWallet.address : 'NOT CONFIGURED'}`);
});

module.exports = app;
