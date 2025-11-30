const Bundle=require('../models/Bundle.js');
const Audit =require('../models/AuditLog.js');
const crypto=require('crypto');

function generateVersionMapping(data) {
  return {
    namaste: data.namaste_code ? 'NAMASTE_v1' : null,
    tm2: data.icd_tm2_code ? 'ICD_11_TM2_2025' : null
  };
}

function generateSignature(payload) {
  const secret = process.env.AUDIT_SECRET || 'default_secret';
  return crypto.createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

async function bundleUpload(req, res, next) {
  try {
    const payload = req.body;

    const bundle = await Bundle.create({
      ...payload,
      rawPayload: payload
    });

    const audit = await Audit.create({
      whoSubmitted: payload.abhaId,
      submittedAt: new Date(),
      signatureHash: generateSignature(payload),
      versionMapping: generateVersionMapping(payload),
      consentFlag: Array.isArray(payload.consentMetaData)
        && payload.consentMetaData.some(c => c.consent === true),
      bundleRef: bundle._id,
      rawPayload: payload
    });

    res.status(201).json({
      success: true,
      bundleId: bundle._id,
      auditId: audit._id
    });

  } catch (err) {
    next(err);
  }
}

module.exports = { bundleUpload };