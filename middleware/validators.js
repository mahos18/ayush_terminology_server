const { validationResult } = require('express-validator');

function validateICDTM(req, res, next) {
  const { entityId } = req.body;
  
  if (!entityId) {
    return res.status(400).json({ error: 'entityId is required in request body' });
  }

  if (typeof entityId !== 'string') {
    return res.status(400).json({ error: 'entityId must be a string' });
  }

  next();
}

function validateSearch(req, res, next) {
  const { q, chapterFilter } = req.body;
  
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  if (typeof q !== 'string') {
    return res.status(400).json({ error: 'Query parameter "q" must be a string' });
  }

  if (chapterFilter && typeof chapterFilter !== 'string') {
    return res.status(400).json({ error: 'chapterFilter must be a string' });
  }

  next();
}


const validateBundle=(req, res, next)=> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
}



module.exports = { validateICDTM, validateSearch , validateBundle };