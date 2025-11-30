// routes/report.js
const express = require("express");
const {validateBundle} = require('../middleware/validators.js');
const {MongoClient} = require('mongodb')   // <-- using your validator
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { bundle, query } = req.body;

    // Validate bundle using your validators.js function
    const valid = validateBundle(bundle);
    if (!valid.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid FHIR bundle",
        details: valid.errors
      });
    }

    // Connect to MongoDB 
    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    
    const db = client.db('ayushsetu');
    const coll = db.collection("REPORT_REQUESTS");

    await coll.insertOne({
      bundle,
      query,
      createdAt: new Date()
    });

    return res.json({
      success: true,
      message: "Bundle stored successfully"
    });

  } catch (err) {
    console.error("Error in /report:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

module.exports = router;
