import {AppError} from '../../shared/errors.mjs';
export const analysisSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    game_plan: { type: 'string', minLength: 1 },
    lessons: { type: 'array', minItems: 1, maxItems: 3, items: {
      type: 'object', additionalProperties: false,
      properties: {
        title: { type: 'string', minLength: 1 },
        teaching: { type: 'string', minLength: 1 },
        application: { type: 'string', minLength: 1 },
        exception: { type: 'string', minLength: 1 },
        time: { type: ['number', 'null'] },
        evidence_ids: { type: 'array', minItems: 1, items: { type: 'string' } }
      }, required: ['title', 'teaching', 'application', 'exception', 'time', 'evidence_ids']
    } },
    confidence: { type: 'string', enum: ['baixa', 'média', 'alta'] },
    strengths: { type: 'array', items: { type: 'string' } },
    findings: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      properties: {
        title: { type: 'string' }, category: { type: 'string', enum: ['economia', 'combate', 'itens', 'mapa', 'objetivos'] },
        severity: { type: 'string', enum: ['alta', 'média', 'baixa'] },
        time: { type: ['number', 'null'] }, observation: { type: 'string' }, recommendation: { type: 'string' },
        rationale: { type: 'string' }, next_game_rule: { type: 'string' }, replay_check: { type: 'string' }, certainty: { type: 'string', enum: ['observado', 'hipótese'] },
        evidence_ids: { type: 'array', items: { type: 'string' }, minItems: 1 }
      }, required: ['title', 'category', 'severity', 'time', 'observation', 'recommendation', 'rationale', 'next_game_rule', 'replay_check', 'certainty', 'evidence_ids']
    } },
    training_plan: { type: 'array', items: { type: 'string' } },
    patch_context: { type: 'string' }, limitations: { type: 'array', items: { type: 'string' } }
  }, required: ['summary', 'game_plan', 'lessons', 'confidence', 'strengths', 'findings', 'training_plan', 'patch_context', 'limitations']
};

export function validateAnalysis(result, evidence) {
  const fail = () => { throw new AppError('A IA retornou uma análise inválida ou sem evidências verificáveis. Tente novamente.', 502); };
  const check = (value, schema) => {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    if (!types.includes(type) || (type === 'number' && !Number.isFinite(value))) fail();
    if (schema.enum && !schema.enum.includes(value)) fail();
    if (type === 'string' && schema.minLength && value.trim().length < schema.minLength) fail();
    if (type === 'object') {
      if (schema.required.some(key => !(key in value))) fail();
      if (Object.keys(value).some(key => !schema.properties[key])) fail();
      for (const [key, val] of Object.entries(value)) check(val, schema.properties[key]);
    }
    if (type === 'array') { if (schema.minItems && value.length < schema.minItems) fail(); if (schema.maxItems && value.length > schema.maxItems) fail(); for (const v of value) check(v, schema.items); }
  };
  check(result, analysisSchema);
  const ids = new Map(evidence.map(e => [e.id, e]));
  for (const finding of [...result.findings, ...result.lessons]) {
    if (finding.evidence_ids.some(id => !ids.has(id))) fail();
    if (finding.time !== null && !finding.evidence_ids.some(id => ids.get(id).time === finding.time)) fail();
  }
  return result;
}

