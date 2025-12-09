const express = require('express');
const { createClient } = require('redis');
require('dotenv').config();
const router = express.Router();

// Use same Redis config as translate.js (or reuse the exported client)
const redisclient = createClient({
  username: 'default',
  password: process.env.REDIS_PASS,
  socket: {
    host: process.env.REDIS_URL,
    port: process.env.REDIS_PORT
  }
});

(async () => {
  redisclient.on('error', err => console.error('Redis Error', err));
  await redisclient.connect();
})();

/**
 * POST /ConceptMap/$translate
 * Accepts FHIR Parameters OR simple JSON:
 *  { system, code, target }
 * Returns a Parameters resource with mapping info.
 */
router.post('/ConceptMap/$translate', async (req, res) => {
  try {
    // Accept either FHIR Parameters or simple JSON
    let system, code, targetSystem;
    if (req.body?.resourceType === 'Parameters') {
      // find parameters by name
      const p = (name) => {
        const parm = (req.body.parameter || []).find(x => x.name === name);
        return parm?.valueString || parm?.valueCode || parm?.valueUri || parm?.value;
      };
      system = p('system');
      code = p('code');
      targetSystem = p('targetSystem');
    } else {
      system = req.body.system;
      code = req.body.code;
      targetSystem = req.body.targetSystem;
    }

    if (!system || !code) {
      return res.status(400).json({ error: "Missing 'system' or 'code'" });
    }

    // Determine forward or reverse lookup by system. Example:
    // if system is NAMASTE -> forward: use hash conceptmap:forward
    // if system is ICD-11 TM2 -> reverse: conceptmap:reverse
    const NAMASTE_SYSTEM = "https://example.org/fhir/CodeSystem/namaste";
    const ICDTM2_SYSTEM = "https://example.org/fhir/CodeSystem/icd11-tm2";

    let raw;
    if (system === NAMASTE_SYSTEM) {
      raw = await redisclient.hGet("conceptmap:forward", code);
    } else if (system === ICDTM2_SYSTEM) {
      raw = await redisclient.hGet("conceptmap:reverse", code);
    } else {
      // try forward then reverse
      raw = await redisclient.hGet("conceptmap:forward", code) || await redisclient.hGet("conceptmap:reverse", code);
    }

    if (!raw) {
      // If no redis cache hit, return a FHIR Parameters with result=false
      const notFound = {
        resourceType: "Parameters",
        parameter: [
          { name: "result", valueBoolean: false },
          { name: "message", valueString: "No mapping found" },
          { name: "inputSystem", valueUri: system },
          { name: "inputCode", valueCode: code }
        ]
      };
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      return res.status(404).json(notFound);
    }

    const mapped = JSON.parse(raw);

    // Build Parameters response with mapping details. Keep it FHIR-friendly:
    const parameters = {
      resourceType: "Parameters",
      parameter: [
        { name: "result", valueBoolean: true },
        { name: "inputSystem", valueUri: system },
        { name: "inputCode", valueCode: code },
        { name: "count", valueInteger: mapped.length }
      ]
    };

    // each mapping becomes a 'match' parameter with sub-parts
    for (const m of mapped.slice(0, 50)) {
      const part = {
        name: "match",
        part: [
          { name: "system", valueUri: targetSystem || (system === NAMASTE_SYSTEM ? ICDTM2_SYSTEM : NAMASTE_SYSTEM) },
          { name: "code", valueCode: m.code || m.code || m.mappedTo?.code || m.mappedTo?.[0]?.code || m.namasteCode },
          { name: "display", valueString: m.display || m.mappedTo?.display || m.namasteDisplay || "" },
          { name: "equivalence", valueString: m.equivalence || m.equiv || "relatedto" },
          { name: "confidence", valueDecimal: m.confidence != null ? m.confidence : (m.confidenceScore || 0) },
        ]
      };
      if (m.comment) part.part.push({ name: "comment", valueString: m.comment });
      parameters.parameter.push(part);
    }

    res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
    return res.json(parameters);

  } catch (err) {
    console.error("Universal translate error:", err);
    return res.status(500).json({ error: "server error" });
  }
});

module.exports = router;
