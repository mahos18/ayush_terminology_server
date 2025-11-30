const express = require('express');
const { MongoClient } = require('mongodb');
const { createClient } = require('redis');
require('dotenv').config();

const router = express.Router();

// --------------------------------------
// MongoDB Setup
// --------------------------------------
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

let conceptMapColl;

// --------------------------------------
// Redis Setup
// --------------------------------------
let redisclient;    
(async () => {

    redisclient = createClient({
    username: 'default',
    password: process.env.REDIS_PASS,
    socket: {
        host: process.env.REDIS_URL,
        port: process.env.REDIS_PORT
    }
});

redisclient.on('error', err => console.log('Redis Client Error', err));

await redisclient.connect();

await redisclient.set('foo', 'bar');
const result = await redisclient.get('foo');
console.log(result)  // >>> bar
    
})();






// --------------------------------------
// BUILD REDIS CACHE FROM MONGO
// --------------------------------------
async function buildRedisCache(redis) {
  console.log("🔄 Loading ConceptMap from Mongo…");

  const raw = await conceptMapColl.findOne({});
  if (!raw?.group?.[0]) {
    console.error("❌ Invalid ConceptMap format");
    return;
  }

  const elements = raw.group[0].element || [];
  console.log(`🔥 Preparing ${elements.length} mappings…`);

  // Clear old cache
  await redis.del("conceptmap:forward", "conceptmap:reverse");

  // PIPELINE START — groups thousands of writes into one command
  const forwardPipe = redis.multi();
  const reversePipe = redis.multi();

  const forwardMap = {};
  const reverseMap = {};

  // First collect everything in memory (FAST)
  for (const el of elements) {
    const nmCode = el.code;
    const nmDisplay = el.display;
    const targets = el.target || [];

    // Store forward mappings in JS object
    forwardMap[nmCode] = forwardMap[nmCode] || [];
    forwardMap[nmCode].push(...targets);

    // Reverse mappings (ICD → NAMASTE)
    for (const t of targets) {
      reverseMap[t.code] = reverseMap[t.code] || [];
      reverseMap[t.code].push({
        namasteCode: nmCode,
        namasteDisplay: nmDisplay,
        equivalence: t.equivalence || "unmatched",
        confidence: t.confidence || 0,
        comment: t.comment || null
      });
    }
  }

  // PIPELINED WRITES — extremely fast 🚀🚀
  for (const key in forwardMap) {
    forwardPipe.hSet("conceptmap:forward", key, JSON.stringify(forwardMap[key]));
  }

  for (const key in reverseMap) {
    reversePipe.hSet("conceptmap:reverse", key, JSON.stringify(reverseMap[key]));
  }

  await forwardPipe.exec();
  await reversePipe.exec();

  console.log("✅ Redis ConceptMap cache loaded instantly!");
}




// --------------------------------------
// INIT DB + BUILD REDIS MAP
// --------------------------------------
async function initDB() {
  await client.connect();
  const db = client.db("ayushsetu");
  conceptMapColl = db.collection("FHIR_CONCEPTMAP");

  console.log("Connected to MongoDB + FHIR_CONCEPTMAP");

  await buildRedisCache(redisclient);  // 🔥 cache load
}
initDB();



// =====================================================
// 1️⃣ POST /translate/to-icdtm2
// NAMASTE → ICD TM2 (FAST via Redis HGET)
// =====================================================
router.post('/to-icdtm2', async (req, res) => {
  try {
    const code = req.body.code?.trim();
    if (!code)
      return res.status(400).json({ error: "Missing NAMASTE code" });

    const raw = await redisclient.hGet("conceptmap:forward", code);
    if (!raw)
      return res.status(404).json({ error: "No mapping found", code });

    let targets = JSON.parse(raw);

    // Sort by confidence score descending
    targets.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    res.json({
      from: "NAMASTE",
      inputCode: code,
      count: targets.length,
      mappedTo: targets.slice(0, 10) // return top 10 ranked
    });

  } catch (err) {
    console.error("Translate Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});




// =====================================================
// 2️⃣ POST /translate/to-namaste
// ICD TM2 → NAMASTE (FAST via Redis HGET)
// =====================================================
router.post('/to-namaste', async (req, res) => {
  try {
    const code = req.body.code?.trim();
    if (!code)
      return res.status(400).json({ error: "Missing ICD TM2 code" });

    const raw = await redisclient.hGet("conceptmap:reverse", code);
    if (!raw)
      return res.status(404).json({ error: "No reverse mapping found", code });

    let matches = JSON.parse(raw);

    matches.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    res.json({
      from: "ICD-TM2",
      inputCode: code,
      totalMatches: matches.length,
      mappedTo: matches.slice(0, 10)
    });

  } catch (err) {
    console.error("Translate Reverse Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});



module.exports = router;
