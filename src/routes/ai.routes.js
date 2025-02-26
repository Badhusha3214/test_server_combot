import express from 'express';
import { generateResponse, healthCheck } from '../controllers/ai.controller.js';

export const router = express.Router();

router.get('/health', healthCheck);
router.post('/generate', generateResponse);
