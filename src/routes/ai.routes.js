import express from 'express';
import { generateResponse } from '../controllers/ai.controller.js';

export const router = express.Router();

router.post('/generate', generateResponse);
