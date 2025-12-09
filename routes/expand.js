// const express = require("express");
// const { MongoClient } = require("mongodb");
// const router = express.Router();
// require('dotenv').config()

// const app = express();
// app.use(express.json());


// const MONGO_URI = process.env.MONGO_URI;
// const DB_NAME = "ayushsetu";

// let db;

// // Utility to escape regex injection
// function escapeRegex(text = "") {
//   return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// }

// // Connect to MongoDB
// async function initDB() {
//   const client = new MongoClient(MONGO_URI);
//   await client.connect();
//   db = client.db(DB_NAME);
//   console.log("Connected to MongoDB:", DB_NAME);
// }
// initDB();
// ``
// /**
//  * Generic autocomplete function
//  */
// export async function autocomplete(collectionName, query, limit = 20) {
//   if (!query) return [];

//   try {
//     const pipeline = [
//       {
//         $search: {
//           index: "default",   // your Atlas Search index name
//           compound: {
//             should: [
//               {
//                 autocomplete: {
//                   query,
//                   path: "concept.display",
//                   tokenOrder: "sequential"
//                 }
//               },
//               {
//                 autocomplete: {
//                   query,
//                   path: "concept.code",
//                   tokenOrder: "sequential"
//                 }
//               },
//               {
//                 autocomplete: {
//                   query,
//                   path: "concept.definition",
//                   tokenOrder: "sequential"
//                }
//               }
//             ],
//             minimumShouldMatch: 1
//           }
//         }
//       },

//       // unwind FHIR concept array
//       { $unwind: "$concept" },

//       // Filter again after unwind (because search may match nested docs)
//       {
//         $match: {
//           $or: [
//             { "concept.code": { $regex: query, $options: "i" } },
//             { "concept.display": { $regex: query, $options: "i" } },
//             { "concept.definition": { $regex: query, $options: "i" } }
//           ]
//         }
//       },

//       // Final projection
//       {
//         $project: {
//           _id: 0,
//           code: "$concept.code",
//           display: "$concept.display",
//           definition: "$concept.definition",
//           score: { $meta: "searchScore" }
//         }
//       },

//       { $limit: limit },
//     ];

//     return await db.collection(collectionName).aggregate(pipeline).toArray();

//   } catch (err) {
//     console.error("⚠ Autocomplete search error:", err);
//     return [];
//   }
// }


// /**
//  * 1️⃣  /lookup/namaste
//  *     Autocomplete NAMASTE codes
//  */
// router.get("/namaste", async (req, res) => {
//   const q = (req.query.q || "").trim();
//   const limit = parseInt(req.query.limit || "20");

//   if (!q) return res.json({ results: [] });

//   const results = await autocomplete("NAMASTE_FHIR_CODESYSTEM", q, limit);
//   return res.json({ results });
// });

// /**
//  * 2️⃣  /lookup/ICD_TM2
//  *     Autocomplete ICD_TM2 codes
//  */
// router.get("/icdtm2", async (req, res) => {
//   const q = (req.query.q || "").trim();
//   const limit = parseInt(req.query.limit || "20");

//   if (!q) return res.json({ results: [] });

//   const results = await autocomplete("ICDTM2_FHIR_CODESYSTEM", q, limit);
//   console.log(results);
//   return res.json({ results });
// });
// module.exports = router;


// expand.js
const express = require("express");
const { MongoClient } = require("mongodb");
const router = express.Router();
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = "ayushsetu";

let db;

// Utility to escape regex injection (kept for possible fallback search)
function escapeRegex(text = "") {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Connect to MongoDB
async function initDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log("Connected to MongoDB:", DB_NAME);
}
initDB().catch(err => console.error("Mongo init error:", err));


/**
 * Generic autocomplete function
 * collectionName: string - collection with FHIR CodeSystem docs
 * query: string - user search text
 * limit: number - max results
 *
 * Returns array of { code, display, definition, score }
 */

// async function autocomplete(collectionName, query, limit = 20) {
//   if (!query) return [];

//   try {
//     const pipeline = [
//       {
//         $search: {
//           index: "default",   // confirm this index exists in Atlas Search
//           compound: {
//             should: [
//               {
//                 autocomplete: {
//                   query,
//                   path: "concept.display",
//                   tokenOrder: "sequential"
//                 }
//               },
//               {
//                 autocomplete: {
//                   query,
//                   path: "concept.code",
//                   tokenOrder: "sequential"
//                 }
//               },
//               {
//                 autocomplete: {
//                   query,
//                   path: "concept.definition",
//                   tokenOrder: "sequential"
//                 }
//               }
//             ],
//             minimumShouldMatch: 1
//           }
//         }
//       },
//       // unwind FHIR concept array
//       { $unwind: "$concept" },
//       // Filter again after unwind (because search may match nested docs)
//       {
//         $match: {
//           $or: [
//             { "concept.code": { $regex: query, $options: "i" } },
//             { "concept.display": { $regex: query, $options: "i" } },
//             { "concept.definition": { $regex: query, $options: "i" } }
//           ]
//         }
//       },
//       // Final projection
//       {
//         $project: {
//           _id: 0,
//           code: "$concept.code",
//           display: "$concept.display",
//           definition: "$concept.definition",
//           score: { $meta: "searchScore" }
//         }
//       },
//       { $limit: limit },
//     ];

//     return await db.collection(collectionName).aggregate(pipeline).toArray();

//   } catch (err) {
//     console.error("⚠ Autocomplete search error:", err);
//     return [];
//   }
// }

async function autocomplete(collectionName, query, limit = 20) {
  // Basic input normalization / sanity checks
  try {
    if (!collectionName || typeof collectionName !== "string") {
      console.error("autocomplete: invalid collectionName:", collectionName);
      return [];
    }

    // Coerce query to a safe string (this avoids accidental req objects or circulars)
    if (query === undefined || query === null) return [];
    if (typeof query !== "string") {
      // if someone passed in an object, try to grab a string field, otherwise stringify safely
      if (typeof query.toString === "function" && query.toString !== Object.prototype.toString) {
        query = String(query.toString());
      } else {
        try {
          query = JSON.stringify(query);k
        } catch (e) {
          // fallback: not serializable, bail out
          console.error("autocomplete: query is not serializable, aborting", e);
          return [];
        }
      }
    }
    query = query.trim();
    if (!query) return [];

    // escape regex metachars for safe usage in $match
    const safeQuery = escapeRegex(query);

    // Build a safe regex object (RegExp is BSON-serializable)
    const re = new RegExp(safeQuery, "i");

    const pipeline = [
      {
        $search: {
          index: "default",
          compound: {
            should: [
              { autocomplete: { query, path: "concept.display", tokenOrder: "sequential" } },
              { autocomplete: { query, path: "concept.code", tokenOrder: "sequential" } },
              { autocomplete: { query, path: "concept.definition", tokenOrder: "sequential" } }
            ],
            minimumShouldMatch: 1
          }
        }
      },
      { $unwind: "$concept" },
      // Use the safe RegExp (not the original object) in $match
      {
        $match: {
          $or: [
            { "concept.code": { $regex: re } },
            { "concept.display": { $regex: re } },
            { "concept.definition": { $regex: re } }
          ]
        }
      },
      {
        $project: {
          _id: 0,
          code: "$concept.code",
          display: "$concept.display",
          definition: "$concept.definition",
          score: { $meta: "searchScore" }
        }
      },
      { $limit: Math.max(1, Math.min(parseInt(limit || 20, 10), 200)) }
    ];

    // Debug guard: ensure pipeline is plain JSON-serializable
    try {
      // This will throw if pipeline contains a circular structure
      JSON.stringify(pipeline);
    } catch (serr) {
      console.error("autocomplete: pipeline not serializable (likely circular).", serr);
      console.error("collectionName:", collectionName, "query type:", typeof query);
      return [];
    }

    // run aggregation
    const coll = db.collection(collectionName);
    if (!coll) {
      console.error("autocomplete: collection not found:", collectionName);
      return [];
    }

    const results = await coll.aggregate(pipeline).toArray();
    return results || [];

  } catch (err) {
    // Better error message for debugging
    console.error("⚠ Autocomplete search error (caught):", err && err.stack ? err.stack : err);
    return [];
  }
}

/**
 * 1️⃣  /lookup/namaste
 *     Autocomplete NAMASTE codes (kept for backward compatibility)
 */
router.get("/namaste", async (req, res) => {
  const q = (req.query.q || "").trim();
  const limit = parseInt(req.query.limit || "20", 10);

  if (!q) return res.json({ results: [] });

  const results = await autocomplete("NAMASTE_FHIR_CODESYSTEM", q, limit);
  return res.json({ results });
});

/**
 * 2️⃣  /lookup/ICD_TM2
 *     Autocomplete ICD_TM2 codes (kept for backward compatibility)
 */
router.get("/icdtm2", async (req, res) => {
  const q = (req.query.q || "").trim();
  const limit = parseInt(req.query.limit || "20", 10);

  if (!q) return res.json({ results: [] });

  const results = await autocomplete("ICDTM2_FHIR_CODESYSTEM", q, limit);
  console.log("icdtm2 results:", results);
  return res.json({ results });
});

module.exports =  autocomplete ;
