// Compatibility exports for integrations and the original Windows entry points.
export {AppError,connectionError,geminiKey} from './backend/shared/errors.mjs';
export {matchId,accountId} from './backend/features/matches/schemas.mjs';
export {buildEvidence} from './backend/features/matches/evidence.mjs';
export {analysisSchema,validateAnalysis} from './backend/features/coaching/schema.mjs';
export {createService} from './backend/features/coaching/service.mjs';
