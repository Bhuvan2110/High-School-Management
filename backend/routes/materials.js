// routes/materials.js
const express = require('express');
const router  = express.Router();
const { uploadMaterial, getMaterialsBySubject, getMyMaterials, downloadMaterial, deleteMaterial } = require('../controllers/materialController');
const { verifyToken, adminOrTeacher, allRoles } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.use(verifyToken);
router.post('/',                   adminOrTeacher,  upload.single('file'), uploadMaterial);
router.get('/my-materials',        allRoles,        getMyMaterials);
router.get('/subject/:id',         allRoles,        getMaterialsBySubject);
router.get('/:id/download',        allRoles,        downloadMaterial);
router.delete('/:id',              adminOrTeacher,  deleteMaterial);

module.exports = router;
