const mongoose = require('mongoose');

const ConsentSchema = new mongoose.Schema({
  source: { type: String },        // who gave consent / metadata owner
  consent: { type: Boolean, default: false },
  timestamp: { type: Date },
  meta: { type: mongoose.Schema.Types.Mixed }
}, { _id: false });

const BundleSchema = new mongoose.Schema({
  abhaId: { type: String, required: true, index: true },
  encounterDetail: { type: mongoose.Schema.Types.Mixed, required: true },
  problemList: { type: [mongoose.Schema.Types.Mixed], default: [] },
  namaste_code: { type: String, default: '' },
  icd_tm2_code: { type: String, default: '' },
  consentMetaData: { type: [ConsentSchema], default: [] },
  createdAt: { type: Date, default: () => new Date() },
  rawPayload: { type: mongoose.Schema.Types.Mixed }
}, {
  collection: 'bundles'
});

module.exports = mongoose.model('Bundle', BundleSchema, 'bundles');