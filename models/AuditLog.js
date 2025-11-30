const mongoose = require('mongoose');

const AuditSchema = new mongoose.Schema({
  whoSubmitted: String,
  submittedAt: Date,
  signatureHash: String,
  versionMapping: mongoose.Schema.Types.Mixed,
  consentFlag: Boolean,
  bundleRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Bundle' },
  rawPayload: mongoose.Schema.Types.Mixed
});

module.exports = mongoose.model('Audit', AuditSchema, 'audits');