// universalExpand.js
const express = require("express");
const router = express.Router();
const  autocomplete  = require("./expand"); // uses the exported function
require('dotenv').config();

// map canonical system URIs to your Mongo collection names
const SYSTEM_TO_COLLECTION = {
  "https://example.org/fhir/CodeSystem/namaste": "NAMASTE_FHIR_CODESYSTEM",
  "https://example.org/fhir/CodeSystem/icd11-tm2": "ICDTM2_FHIR_CODESYSTEM",
  "https://example.org/fhir/CodeSystem/biomed": "BIOMED_FHIR_CODESYSTEM"
};

/**
 * Helper to build a ValueSet expansion
 */
function buildValueSet(system, results) {
  return {
    resourceType: "ValueSet",
    status: "active",
    expansion: {
      identifier: `exp-${Date.now()}`,
      timestamp: new Date().toISOString(),
      total: results.length,
      contains: results.map(r => {
        const entry = {
          system,
          code: String(r.code).replace(/\s+/g, "_"),
          display: r.display
        };
        if (r.definition) entry.definition = r.definition;
        if (typeof r.score !== "undefined") {
          entry.extension = [
            {
              url: "https://example.org/fhir/StructureDefinition/search-score",
              valueDecimal: r.score
            }
          ];
        }
        return entry;
      })
    }
  };
}

/**
 * GET /ValueSet/$expand?system=<system>&q=<text>&limit=20
 */
router.get("/ValueSet/$expand", async (req, res) => {
  try {
    const system = (req.query.system || "").trim();
    const q = (req.query.q || "").trim();
    const limit = parseInt(req.query.limit || "20", 10);

    if (!system) return res.status(400).json({ error: "Missing 'system' query parameter" });
    if (!q) return res.status(400).json({ error: "Missing 'q' query parameter" });

    const collection = SYSTEM_TO_COLLECTION[system];
    if (!collection) return res.status(400).json({ error: "Unknown system", system });

    const results = await autocomplete(collection, q, limit);
    const vs = buildValueSet(system, results);

    res.setHeader("Content-Type", "application/fhir+json");
    return res.json(vs);
  } catch (err) {
    console.error("universal expand GET error:", err);
    return res.status(500).json({ error: "server error" });
  }
});

/**
 * POST /ValueSet/$expand
 * Accepts FHIR Parameters:
 * { resourceType: "Parameters", parameter:[ {name:"url", valueUri:...}, {name:"filter", valueString:...}, {name:"limit", valueInteger:...} ] }
 */
router.post("/ValueSet/$expand", async (req, res) => {
  try {
    const body = req.body || {};
    if (body.resourceType !== "Parameters") return res.status(400).json({ error: "Expecting Parameters resource" });

    const param = (name) => {
      const found = (body.parameter || []).find(p => p.name === name);
      return found ? (found.valueString || found.valueUri || found.valueCode || found.valueInteger) : null;
    };

    const system = param("url") || param("system");
    const q = param("filter");
    const limit = parseInt(param("limit") || "20", 10);

    if (!system || !q) return res.status(400).json({ error: "Parameters 'url' (system) and 'filter' required" });

    const collection = SYSTEM_TO_COLLECTION[system];
    if (!collection) return res.status(400).json({ error: "Unknown system", system });
    console.log("step1")
    console.log(collection, q, limit);
    const results = await autocomplete(collection, q, limit);
    const vs = buildValueSet(system, results);
    console.log("step3")
    res.setHeader("Content-Type", "application/fhir+json");
    return res.json(vs);
  } catch (err) {
    console.error("universal expand POST error:", err);
    return res.status(500).json({ error: "server error" });
  }
});

module.exports = router;
