export const pick = (object, fields) => Object.fromEntries(fields.filter(k => object?.[k] !== undefined && object[k] !== null).map(k => [k, object[k]]));
export const safeText = value => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 7000);
