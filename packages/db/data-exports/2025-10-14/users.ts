/**
 * users data export
 * Generated: 2025-10-14T16:32:34.205Z
 *
 * IMPORTANT: You can manually edit this file to adjust for schema changes.
 * - Add/remove fields as needed
 * - Update field names to match new schema
 * - Modify values
 *
 * When importing, the import script will validate against current schema.
 */

export const usersData = [
  {
    id: "18a350db-9b16-4640-90ab-ad0f76c0bce9",
    email: "operator@example.com",
    name: "Production Operator",
    passwordHash: "$2b$10$AxVv80YjTlAH8cVVSvMpjeBwXhNjDQYSZVKZwsn7wZqanpT9QQoBS",
    role: "operator",
    isActive: true,
    lastLoginAt: null,
    createdAt: "2025-09-12T21:31:30.695Z",
    updatedAt: "2025-09-12T21:31:30.695Z",
    deletedAt: null
  },
  {
    id: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    email: "admin@example.com",
    name: "System Administrator",
    passwordHash: "$2b$10$z4ePYU7l8aTiwovAV3vmDu50Sr.KUyqeE4YEB2YzOE4/4BwIcJyr6",
    role: "admin",
    isActive: true,
    lastLoginAt: "2025-09-17T15:15:23.299Z",
    createdAt: "2025-09-12T21:31:30.695Z",
    updatedAt: "2025-09-12T21:31:30.695Z",
    deletedAt: null
  },
  {
    id: "8356e824-6b53-4751-b3ac-08a0df9327b9",
    email: "swierzbo@yahoo.com",
    name: "Admin User",
    passwordHash: "$2b$10$V13j3JnJXN.gY2YWyUTWg.vLnlawTM3XSsby5bidQsDHNcxfS.N/y",
    role: "admin",
    isActive: true,
    lastLoginAt: "2025-10-11T02:57:13.496Z",
    createdAt: "2025-09-29T18:35:17.976Z",
    updatedAt: "2025-09-29T18:35:17.976Z",
    deletedAt: null
  }
] as const;

export default usersData;
