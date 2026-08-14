// POST /api/leads/transfer
// Plain transfer INQUIRY only: name, phone, email, free-text item
// description, message. No regulated logic, no fees, no e-commerce.
import { createLeadEndpoint } from '../_lib/leadEndpoint.js';

export default createLeadEndpoint('transfer');
