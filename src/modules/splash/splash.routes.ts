import { Router } from 'express';
import { SplashController } from './splash.controller';

const router = Router();

router.get('/status', SplashController.getStatus);

export default router;
