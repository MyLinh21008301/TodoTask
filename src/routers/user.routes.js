// src/routers/user.routes.js
import express from 'express';
import { getUserPublicProfileById } from '../controllers/user.controller.js';
const router = express.Router();
router.get('/:id', getUserPublicProfileById);

export default router;