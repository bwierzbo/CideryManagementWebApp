/**
 * auditLog data export
 * Generated: 2025-09-29T19:38:27.756Z
 *
 * IMPORTANT: You can manually edit this file to adjust for schema changes.
 * - Add/remove fields as needed
 * - Update field names to match new schema
 * - Modify values
 *
 * When importing, the import script will validate against current schema.
 */

export const auditLogData = [
  {
    id: "df8dc7d7-5fa5-4ffe-819a-c4fd5356be15",
    tableName: "vendors",
    recordId: "d90e6efe-0384-4c21-8cb5-0e211a475449",
    operation: "delete",
    oldData: {
      id: "d90e6efe-0384-4c21-8cb5-0e211a475449",
      name: "Heritage Fruit Co.",
      isActive: true,
      createdAt: "2025-09-12T21:31:30.810Z",
      deletedAt: null,
      updatedAt: "2025-09-12T21:31:30.810Z",
      contactInfo: {
        email: "info@heritagefruit.com",
        phone: "555-0789",
        address: "789 Heritage Way, Old Town, MA 01234"
      }
    },
    newData: {
      isActive: false
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-13T03:03:47.005Z",
    reason: null
  },
  {
    id: "827c8f09-0eca-4cd4-83a8-4e0f6a373cac",
    tableName: "vendors",
    recordId: "8fcf0593-e3e5-40bc-a851-1a01a770fa2d",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "8fcf0593-e3e5-40bc-a851-1a01a770fa2d",
      vendorName: "tes"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-13T03:04:14.574Z",
    reason: null
  },
  {
    id: "bed580f0-b32a-4436-bf8f-b55b8cc34820",
    tableName: "vendors",
    recordId: "8fcf0593-e3e5-40bc-a851-1a01a770fa2d",
    operation: "delete",
    oldData: {
      id: "8fcf0593-e3e5-40bc-a851-1a01a770fa2d",
      name: "tes",
      isActive: true,
      createdAt: "2025-09-13T03:04:14.315Z",
      deletedAt: null,
      updatedAt: "2025-09-13T03:04:14.315Z",
      contactInfo: null
    },
    newData: {
      isActive: false
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-13T22:01:24.043Z",
    reason: null
  },
  {
    id: "4b2a9435-5684-4f3a-b615-5d1fb00a9c6b",
    tableName: "vendors",
    recordId: "2408ce9f-fdb2-45fe-9b87-49922ca151d5",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "2408ce9f-fdb2-45fe-9b87-49922ca151d5",
      vendorName: "Rob & Dana"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-13T22:27:34.585Z",
    reason: null
  },
  {
    id: "4385887e-cdc9-4e5f-a9ce-f8e444274ef4",
    tableName: "vendors",
    recordId: "9f379c32-97d9-4aa3-b09e-e6845ca48f43",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "9f379c32-97d9-4aa3-b09e-e6845ca48f43",
      vendorName: "Denver"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-14T02:41:21.768Z",
    reason: null
  },
  {
    id: "c77c6c96-fdd1-49aa-878c-86343b2754b4",
    tableName: "vendors",
    recordId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      vendorName: "Olympic Bluff Cidery"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-14T02:44:17.669Z",
    reason: null
  },
  {
    id: "7f9f1199-656f-46ab-ab76-5a29567ee49d",
    tableName: "vendors",
    recordId: "2408ce9f-fdb2-45fe-9b87-49922ca151d5",
    operation: "update",
    oldData: {
      id: "2408ce9f-fdb2-45fe-9b87-49922ca151d5",
      name: "Rob & Dana",
      isActive: true,
      createdAt: "2025-09-13T22:27:34.545Z",
      deletedAt: null,
      updatedAt: "2025-09-13T22:27:34.545Z",
      contactInfo: null
    },
    newData: {
      name: "Rob & Dana",
      contactInfo: {
        email: "contact@vendor.com"
      }
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-14T02:58:02.845Z",
    reason: null
  },
  {
    id: "8b303788-fa1c-4e5a-8b8f-ecc4721606ba",
    tableName: "vendors",
    recordId: "725cebcb-7bdb-4d44-8d58-394a09a0e936",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "725cebcb-7bdb-4d44-8d58-394a09a0e936",
      vendorName: "Test Vendor"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-14T20:49:06.437Z",
    reason: null
  },
  {
    id: "2ef896b5-6ae9-4d5a-8e57-348738186143",
    tableName: "vendors",
    recordId: "725cebcb-7bdb-4d44-8d58-394a09a0e936",
    operation: "update",
    oldData: {
      id: "725cebcb-7bdb-4d44-8d58-394a09a0e936",
      name: "Test Vendor",
      isActive: true,
      createdAt: "2025-09-14T20:49:06.428Z",
      deletedAt: null,
      updatedAt: "2025-09-14T20:49:06.428Z",
      contactInfo: {
        email: "test@vendor.com",
        phone: "555-123-0000",
        address: "100 Test Ave, Test City"
      }
    },
    newData: {
      name: "Test Vendor",
      contactInfo: {
        email: "test@vendor.com",
        phone: "555-999-0000",
        address: "100 Test Ave, Test City"
      }
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-14T20:49:17.191Z",
    reason: null
  },
  {
    id: "9efb6fa3-0507-47b2-8c00-32671ff963cc",
    tableName: "vendors",
    recordId: "725cebcb-7bdb-4d44-8d58-394a09a0e936",
    operation: "delete",
    oldData: {
      id: "725cebcb-7bdb-4d44-8d58-394a09a0e936",
      name: "Test Vendor",
      isActive: true,
      createdAt: "2025-09-14T20:49:06.428Z",
      deletedAt: null,
      updatedAt: "2025-09-14T20:49:17.185Z",
      contactInfo: {
        email: "test@vendor.com",
        phone: "555-999-0000",
        address: "100 Test Ave, Test City"
      }
    },
    newData: {
      isActive: false
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-14T20:49:20.712Z",
    reason: null
  },
  {
    id: "fa2fec6d-8a0c-41f6-a681-5f8e5a5a7b19",
    tableName: "vendors",
    recordId: "9f379c32-97d9-4aa3-b09e-e6845ca48f43",
    operation: "update",
    oldData: {
      id: "9f379c32-97d9-4aa3-b09e-e6845ca48f43",
      name: "Denver",
      isActive: true,
      createdAt: "2025-09-14T02:41:21.514Z",
      deletedAt: null,
      updatedAt: "2025-09-14T02:41:21.514Z",
      contactInfo: {
        email: "contact@vendor.com",
        phone: "5712713751",
        address: "807 W CHURCH ST"
      }
    },
    newData: {
      name: "Denver Vaughn",
      contactInfo: {
        email: "contact@vendor.com",
        phone: "3604772626",
        address: "Matson Rd, Port Angeles, WA 98362"
      }
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T18:58:29.284Z",
    reason: null
  },
  {
    id: "853d335f-ef00-4210-a2d4-54b4747f8111",
    tableName: "vendors",
    recordId: "9f379c32-97d9-4aa3-b09e-e6845ca48f43",
    operation: "update",
    oldData: {
      id: "9f379c32-97d9-4aa3-b09e-e6845ca48f43",
      name: "Denver Vaughn",
      isActive: true,
      createdAt: "2025-09-14T02:41:21.514Z",
      deletedAt: null,
      updatedAt: "2025-09-15T18:58:29.275Z",
      contactInfo: {
        email: "contact@vendor.com",
        phone: "3604772626",
        address: "Matson Rd, Port Angeles, WA 98362"
      }
    },
    newData: {
      name: "Denver Vaughn",
      contactInfo: {
        phone: "3604772626",
        address: "Matson Rd, Port Angeles, WA 98362"
      }
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T18:59:00.588Z",
    reason: null
  },
  {
    id: "f7abe027-7abd-49df-8af1-f25faafd3c30",
    tableName: "vendors",
    recordId: "d90e6efe-0384-4c21-8cb5-0e211a475449",
    operation: "delete",
    oldData: {
      id: "d90e6efe-0384-4c21-8cb5-0e211a475449",
      name: "Heritage Fruit Co.",
      isActive: true,
      createdAt: "2025-09-12T21:31:30.810Z",
      deletedAt: null,
      updatedAt: "2025-09-13T03:03:46.679Z",
      contactInfo: {
        email: "info@heritagefruit.com",
        phone: "555-0789",
        address: "789 Heritage Way, Old Town, MA 01234"
      }
    },
    newData: {
      isActive: false
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T18:59:05.641Z",
    reason: null
  },
  {
    id: "a2ed55a8-d163-43e5-b36f-98cb9b5db8b9",
    tableName: "vendors",
    recordId: "b1a51dfe-a8ea-4cc0-91cb-d6b63be9837e",
    operation: "delete",
    oldData: {
      id: "b1a51dfe-a8ea-4cc0-91cb-d6b63be9837e",
      name: "Mountain View Orchards",
      isActive: true,
      createdAt: "2025-09-12T21:31:30.810Z",
      deletedAt: null,
      updatedAt: "2025-09-12T21:31:30.810Z",
      contactInfo: {
        email: "orders@mountainview.com",
        phone: "555-0123",
        address: "123 Orchard Lane, Apple Valley, NY 12345"
      }
    },
    newData: {
      isActive: false
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T18:59:08.192Z",
    reason: null
  },
  {
    id: "acda6c58-fd26-4bcc-8304-c83464831570",
    tableName: "vendors",
    recordId: "2408ce9f-fdb2-45fe-9b87-49922ca151d5",
    operation: "update",
    oldData: {
      id: "2408ce9f-fdb2-45fe-9b87-49922ca151d5",
      name: "Rob & Dana",
      isActive: true,
      createdAt: "2025-09-13T22:27:34.545Z",
      deletedAt: null,
      updatedAt: "2025-09-14T02:58:02.657Z",
      contactInfo: {
        email: "contact@vendor.com"
      }
    },
    newData: {
      name: "Rob & Dana Middleton",
      contactInfo: {
        email: "dana@danamiddleton.com",
        phone: "3076991538"
      }
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T19:01:30.964Z",
    reason: null
  },
  {
    id: "2e700d54-c692-4e3b-8c7b-2e0fec9d5e09",
    tableName: "vendors",
    recordId: "56ae768d-e9fa-4f58-a96b-ee99020efb6d",
    operation: "delete",
    oldData: {
      id: "56ae768d-e9fa-4f58-a96b-ee99020efb6d",
      name: "Sunrise Apple Farm",
      isActive: true,
      createdAt: "2025-09-12T21:31:30.810Z",
      deletedAt: null,
      updatedAt: "2025-09-12T21:31:30.810Z",
      contactInfo: {
        email: "sales@sunriseapple.com",
        phone: "555-0456",
        address: "456 Farm Road, Cider Springs, VT 05678"
      }
    },
    newData: {
      isActive: false
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T19:01:34.406Z",
    reason: null
  },
  {
    id: "67488fc9-71bf-4940-a91f-acf856b17a3b",
    tableName: "vendors",
    recordId: "725cebcb-7bdb-4d44-8d58-394a09a0e936",
    operation: "delete",
    oldData: {
      id: "725cebcb-7bdb-4d44-8d58-394a09a0e936",
      name: "Test Vendor",
      isActive: true,
      createdAt: "2025-09-14T20:49:06.428Z",
      deletedAt: null,
      updatedAt: "2025-09-14T20:49:20.707Z",
      contactInfo: {
        email: "test@vendor.com",
        phone: "555-999-0000",
        address: "100 Test Ave, Test City"
      }
    },
    newData: {
      isActive: false
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T19:01:36.457Z",
    reason: null
  },
  {
    id: "2491703c-8903-4553-aaee-1fc6c89a02da",
    tableName: "vendors",
    recordId: "28948ea1-20ce-4335-ba07-d1400a60732d",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "28948ea1-20ce-4335-ba07-d1400a60732d",
      vendorName: "Victor Gonzalez"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T19:03:24.522Z",
    reason: null
  },
  {
    id: "7beeb15a-a40c-4c7e-9cfe-7db54f9f809c",
    tableName: "vendors",
    recordId: "ca9a69d1-ac63-4a96-98db-8bd5db6d18bc",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "ca9a69d1-ac63-4a96-98db-8bd5db6d18bc",
      vendorName: "Mick"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T19:06:51.568Z",
    reason: null
  },
  {
    id: "95b50a44-3d48-48f9-bdfd-05466c6a41b7",
    tableName: "vendors",
    recordId: "ca9a69d1-ac63-4a96-98db-8bd5db6d18bc",
    operation: "update",
    oldData: {
      id: "ca9a69d1-ac63-4a96-98db-8bd5db6d18bc",
      name: "Mick",
      isActive: true,
      createdAt: "2025-09-15T19:06:51.533Z",
      deletedAt: null,
      updatedAt: "2025-09-15T19:06:51.533Z",
      contactInfo: {
        email: "contact@vendor.com",
        phone: "3606814417",
        address: "953 Evans Road, Sequim WA 98362"
      }
    },
    newData: {
      name: "Mick",
      contactInfo: {
        phone: "3606814417",
        address: "953 Evans Road, Sequim WA 98362"
      }
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T19:06:57.803Z",
    reason: null
  },
  {
    id: "586def72-005a-462a-945c-c11225203999",
    tableName: "vendors",
    recordId: "72c5dac5-2978-4b22-a69d-0d23a23c9590",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "72c5dac5-2978-4b22-a69d-0d23a23c9590",
      vendorName: "Carlos Murrugarra"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T19:08:30.373Z",
    reason: null
  },
  {
    id: "531bf028-2471-4701-80f1-d33d590e6f19",
    tableName: "vendors",
    recordId: "a85e8d60-f564-4c82-8f9a-f62db431c56b",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "a85e8d60-f564-4c82-8f9a-f62db431c56b",
      vendorName: "Ethel Fullautho"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T19:09:17.740Z",
    reason: null
  },
  {
    id: "273dddb5-f4a8-4da8-83e2-10e93aead3ac",
    tableName: "vendors",
    recordId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T19:10:37.528Z",
    reason: null
  },
  {
    id: "906f597f-0704-46c6-b68c-370c13e55a9d",
    tableName: "vendors",
    recordId: "3829cd75-5557-4619-8195-4a653955e365",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3829cd75-5557-4619-8195-4a653955e365",
      vendorName: "Janelle Cole"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T19:12:06.516Z",
    reason: null
  },
  {
    id: "ea388089-d0b4-421b-888d-a70c2afd83d5",
    tableName: "vendors",
    recordId: "def086e4-81d5-4916-94e2-366aad247a42",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "def086e4-81d5-4916-94e2-366aad247a42",
      vendorName: "Bob and Sally "
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T19:13:12.781Z",
    reason: null
  },
  {
    id: "6c5f6b87-8266-49bc-9641-e4afb0ade051",
    tableName: "vendors",
    recordId: "72c5dac5-2978-4b22-a69d-0d23a23c9590",
    operation: "update",
    oldData: {
      id: "72c5dac5-2978-4b22-a69d-0d23a23c9590",
      name: "Carlos Murrugarra",
      isActive: true,
      createdAt: "2025-09-15T19:08:30.343Z",
      deletedAt: null,
      updatedAt: "2025-09-15T19:08:30.343Z",
      contactInfo: {
        email: "contact@vendor.com",
        phone: "3869836075",
        address: "270 Pond Lane, Sequim, WA, 98362"
      }
    },
    newData: {
      name: "Carlos Murrugarra",
      contactInfo: {
        phone: "3869836075",
        address: "270 Pond Lane, Sequim, WA, 98362"
      }
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T19:13:18.550Z",
    reason: null
  },
  {
    id: "9989d6fb-cf8f-46ef-ac2a-306591f65ad8",
    tableName: "vendors",
    recordId: "a85e8d60-f564-4c82-8f9a-f62db431c56b",
    operation: "update",
    oldData: {
      id: "a85e8d60-f564-4c82-8f9a-f62db431c56b",
      name: "Ethel Fullautho",
      isActive: true,
      createdAt: "2025-09-15T19:09:17.707Z",
      deletedAt: null,
      updatedAt: "2025-09-15T19:09:17.707Z",
      contactInfo: {
        email: "contact@vendor.com",
        phone: "3604609529",
        address: "953 Evans Road, Sequim WA 98362"
      }
    },
    newData: {
      name: "Ethel Fullautho",
      contactInfo: {
        phone: "3604609529",
        address: "953 Evans Road, Sequim WA 98362"
      }
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T19:13:24.083Z",
    reason: null
  },
  {
    id: "b3f43a1d-a1a4-4645-a9fe-3082ef78e9b7",
    tableName: "vendors",
    recordId: "3829cd75-5557-4619-8195-4a653955e365",
    operation: "update",
    oldData: {
      id: "3829cd75-5557-4619-8195-4a653955e365",
      name: "Janelle Cole",
      isActive: true,
      createdAt: "2025-09-15T19:12:06.464Z",
      deletedAt: null,
      updatedAt: "2025-09-15T19:12:06.464Z",
      contactInfo: {
        email: "contact@vendor.com",
        phone: "3607758395"
      }
    },
    newData: {
      name: "Janelle Cole",
      contactInfo: {
        phone: "3607758395"
      }
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T19:13:29.127Z",
    reason: null
  },
  {
    id: "8b95f388-ecb8-4b44-9be2-e886c1e87e85",
    tableName: "vendors",
    recordId: "def086e4-81d5-4916-94e2-366aad247a42",
    operation: "update",
    oldData: {
      id: "def086e4-81d5-4916-94e2-366aad247a42",
      name: "Bob and Sally ",
      isActive: true,
      createdAt: "2025-09-15T19:13:12.750Z",
      deletedAt: null,
      updatedAt: "2025-09-15T19:13:12.750Z",
      contactInfo: {
        phone: "3607757451"
      }
    },
    newData: {
      name: "Bob and Sally Rodgers",
      contactInfo: {
        phone: "3607757451"
      }
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T19:13:45.455Z",
    reason: null
  },
  {
    id: "cf3393fc-096a-48c7-9176-79f259c84177",
    tableName: "vendors",
    recordId: "69834f95-ee70-47cc-bfa4-ae09abfa7e6f",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "69834f95-ee70-47cc-bfa4-ae09abfa7e6f",
      vendorName: "Lazy J (Steve Johnson)"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T19:16:21.159Z",
    reason: null
  },
  {
    id: "579b569d-acdf-4aac-a5b4-11455744a77c",
    tableName: "vendors",
    recordId: "4b13e84d-112e-4eab-8bb0-dab30af0e8f9",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "4b13e84d-112e-4eab-8bb0-dab30af0e8f9",
      vendorName: "Michelle McGuinness"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T19:17:38.451Z",
    reason: null
  },
  {
    id: "68c5fd97-c84d-4598-89ba-4d2146928ecf",
    tableName: "vendors",
    recordId: "69834f95-ee70-47cc-bfa4-ae09abfa7e6f",
    operation: "update",
    oldData: {
      id: "69834f95-ee70-47cc-bfa4-ae09abfa7e6f",
      name: "Lazy J (Steve Johnson)",
      isActive: true,
      createdAt: "2025-09-15T19:16:21.121Z",
      deletedAt: null,
      updatedAt: "2025-09-15T19:16:21.121Z",
      contactInfo: {
        phone: "360 4575950",
        address: "Gerke Road, Port Angeles, WA 98362"
      }
    },
    newData: {
      name: "Lazy J (Steve Johnson)",
      contactInfo: {
        phone: "3604575950",
        address: "Gerke Road, Port Angeles, WA 98362"
      }
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T19:17:52.826Z",
    reason: null
  },
  {
    id: "ce6dd33b-3012-4ba5-956f-1fb2747c3ae2",
    tableName: "vendors",
    recordId: "28948ea1-20ce-4335-ba07-d1400a60732d",
    operation: "update",
    oldData: {
      id: "28948ea1-20ce-4335-ba07-d1400a60732d",
      name: "Victor Gonzalez",
      isActive: true,
      createdAt: "2025-09-15T19:03:24.487Z",
      deletedAt: null,
      updatedAt: "2025-09-15T19:03:24.487Z",
      contactInfo: {
        email: "info@victorslavender.com",
        phone: "(360) 681-7930",
        address: "3743 Old Olympic Hwy, Port Angeles, WA 98362"
      }
    },
    newData: {
      name: "Victor Gonzalez",
      contactInfo: {
        email: "info@victorslavender.com",
        phone: "3606817930",
        address: "3743 Old Olympic Hwy, Port Angeles, WA 98362"
      }
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T19:18:04.833Z",
    reason: null
  },
  {
    id: "04067605-2ac6-432e-9e56-2b0ef4f25813",
    tableName: "apple_varieties",
    recordId: "ef9bc6f2-707a-4465-a25b-1e28cb1f02eb",
    operation: "create",
    oldData: null,
    newData: {
      name: "Test",
      varietyId: "ef9bc6f2-707a-4465-a25b-1e28cb1f02eb"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T22:37:14.766Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "56c8f25f-60e0-43e5-8d0d-cdf86457f980",
    tableName: "vendor_varieties",
    recordId: "2dcc5ade-3a04-43c1-b623-c0af3367e2dc",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "def086e4-81d5-4916-94e2-366aad247a42",
      varietyId: "ef9bc6f2-707a-4465-a25b-1e28cb1f02eb",
      vendorName: "Bob and Sally Rodgers",
      varietyName: "Test"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T22:37:14.766Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "9c7b216d-d8a6-4c10-a451-9fd5bee44d9c",
    tableName: "vendor_varieties",
    recordId: "2dcc5ade-3a04-43c1-b623-c0af3367e2dc",
    operation: "delete",
    oldData: {
      vendorId: "def086e4-81d5-4916-94e2-366aad247a42",
      varietyId: "ef9bc6f2-707a-4465-a25b-1e28cb1f02eb",
      vendorName: "Bob and Sally Rodgers",
      varietyName: "Test"
    },
    newData: {
      deletedAt: "2025-09-15T22:45:45.507Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T22:45:45.311Z",
    reason: "Vendor-variety link removed via API"
  },
  {
    id: "7875c185-a76b-445b-b64a-27e0c855433f",
    tableName: "apple_varieties",
    recordId: "a997aa18-d295-4825-9430-d0d6af349e1e",
    operation: "create",
    oldData: null,
    newData: {
      name: "test1",
      varietyId: "a997aa18-d295-4825-9430-d0d6af349e1e"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T22:45:58.943Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "37c2ff65-49ee-463d-badd-ffa5d35f821c",
    tableName: "vendor_varieties",
    recordId: "0a126a49-1189-41bb-b1af-aaaebefcb1a2",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "def086e4-81d5-4916-94e2-366aad247a42",
      varietyId: "a997aa18-d295-4825-9430-d0d6af349e1e",
      vendorName: "Bob and Sally Rodgers",
      varietyName: "test1"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T22:45:58.943Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "5f3273e8-83e1-44c3-9f71-2aa9650adf79",
    tableName: "vendor_varieties",
    recordId: "0a126a49-1189-41bb-b1af-aaaebefcb1a2",
    operation: "delete",
    oldData: {
      vendorId: "def086e4-81d5-4916-94e2-366aad247a42",
      varietyId: "a997aa18-d295-4825-9430-d0d6af349e1e",
      vendorName: "Bob and Sally Rodgers",
      varietyName: "test1"
    },
    newData: {
      deletedAt: "2025-09-15T22:46:14.968Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T22:46:14.742Z",
    reason: "Vendor-variety link removed via API"
  },
  {
    id: "0268fb0f-c9c0-4bf1-a16b-06b2f5d31414",
    tableName: "vendor_varieties",
    recordId: "626c1ba8-75b4-411b-b23c-986037d7596a",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "def086e4-81d5-4916-94e2-366aad247a42",
      varietyId: "2141f56d-0e45-4d37-b7b5-0e36082a75f9",
      vendorName: "Bob and Sally Rodgers",
      varietyName: "Gala"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T22:46:29.955Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "5511ddf8-dd90-4722-ad1b-8eaeb7976023",
    tableName: "vendor_varieties",
    recordId: "0114efb6-a9b2-4f40-aa25-2a8eaa1fada0",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "def086e4-81d5-4916-94e2-366aad247a42",
      varietyId: "50d69a34-c8c8-42b9-b9e1-dddc6b329485",
      vendorName: "Bob and Sally Rodgers",
      varietyName: "Northern Spy"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-15T22:46:35.998Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "ab949c00-fafb-405d-9bce-569f0361ecb3",
    tableName: "vendor_varieties",
    recordId: "7544aca7-fae9-4d49-9762-db11ea502038",
    operation: "delete",
    oldData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "6ab92f47-2cde-4dcd-9050-3e2f8e7e5777",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Honeycrisp"
    },
    newData: {
      deletedAt: "2025-09-16T05:42:37.720Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-16T05:42:37.562Z",
    reason: "Vendor-variety link removed via API"
  },
  {
    id: "0982d5f6-ef95-4817-a5c1-1a718aa72333",
    tableName: "vendor_varieties",
    recordId: "ffb05d14-725d-4db0-99ac-56a41d092cb1",
    operation: "delete",
    oldData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "50d69a34-c8c8-42b9-b9e1-dddc6b329485",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Northern Spy"
    },
    newData: {
      deletedAt: "2025-09-16T05:42:39.160Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-16T05:42:38.934Z",
    reason: "Vendor-variety link removed via API"
  },
  {
    id: "50e93b33-6bc7-4a35-863a-a4303b3468ab",
    tableName: "vendor_varieties",
    recordId: "27a922e0-aeba-48df-a35e-7db27eab4cef",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "9d64ba7f-577e-47d2-b962-3df5a15878cb",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Fameuse (Snow Apple)"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-16T05:42:47.667Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "590f4437-8c56-4153-a834-2bb1b45b5331",
    tableName: "vendor_varieties",
    recordId: "2bf3aa2b-bb7f-4936-bae2-d346666e002f",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "9f379c32-97d9-4aa3-b09e-e6845ca48f43",
      varietyId: "42230ead-5cd8-400a-9f76-1ac3f46c092d",
      vendorName: "Denver Vaughn",
      varietyName: "Misc."
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-16T14:58:08.628Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "6b3efc83-c3af-4bb3-969b-35f4ea3ddd3a",
    tableName: "vendor_varieties",
    recordId: "5fa9e29e-f525-446e-b48c-7f1a2ba7b4c7",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "ca9a69d1-ac63-4a96-98db-8bd5db6d18bc",
      varietyId: "50d69a34-c8c8-42b9-b9e1-dddc6b329485",
      vendorName: "Mick",
      varietyName: "Northern Spy"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-16T14:58:20.329Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "f52d606b-495e-4fab-af5e-8cdb07ed2b20",
    tableName: "vendor_varieties",
    recordId: "ee323bc7-3204-4ce5-9533-3312f77c8396",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "ca9a69d1-ac63-4a96-98db-8bd5db6d18bc",
      varietyId: "72aef0a9-851a-4087-a287-b61b41256de8",
      vendorName: "Mick",
      varietyName: "Gravenstein"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-16T14:58:24.873Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "21bbd16e-0627-437a-bd6f-61cda82e2b97",
    tableName: "vendor_varieties",
    recordId: "c7518e77-01f7-4ad4-b18f-b5ae8ce95ed5",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "ca9a69d1-ac63-4a96-98db-8bd5db6d18bc",
      varietyId: "8053bfff-b26d-4b32-bac7-09e8abaae6fb",
      vendorName: "Mick",
      varietyName: "Ashmead's Kernel"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-16T14:58:31.765Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "9d8eb4c9-2c58-44de-87fb-33a670164037",
    tableName: "vendor_varieties",
    recordId: "a25d0f9a-4118-4ad4-8bdc-f95af906cbde",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "ca9a69d1-ac63-4a96-98db-8bd5db6d18bc",
      varietyId: "42230ead-5cd8-400a-9f76-1ac3f46c092d",
      vendorName: "Mick",
      varietyName: "Misc."
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-16T14:58:39.567Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "46f8b7d7-a440-4573-9d04-cf8cc14bc0c9",
    tableName: "vendors",
    recordId: "94930e35-0bb8-470e-9474-70b7878aeea9",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "94930e35-0bb8-470e-9474-70b7878aeea9",
      vendorName: "Jennifer Johnson"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-16T15:00:25.093Z",
    reason: null
  },
  {
    id: "5b247065-a55e-4555-8231-d60ce7c3d15d",
    tableName: "vendor_varieties",
    recordId: "1881de4a-a2f0-4cd4-99f7-d92704f95bf1",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "94930e35-0bb8-470e-9474-70b7878aeea9",
      varietyId: "50d69a34-c8c8-42b9-b9e1-dddc6b329485",
      vendorName: "Jennifer Johnson",
      varietyName: "Northern Spy"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-16T15:01:36.031Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "6783a1a9-3f50-4e6d-a1f1-29239a5e1320",
    tableName: "vendor_varieties",
    recordId: "29e9188f-1329-4eb2-8e27-d4c729403f72",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "94930e35-0bb8-470e-9474-70b7878aeea9",
      varietyId: "7f6872fa-bbc8-4ae2-a7bb-b54ae510efe8",
      vendorName: "Jennifer Johnson",
      varietyName: "McIntosh"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-16T15:02:42.828Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "b40c0ad2-3efc-4bd6-93fe-9780c01e8930",
    tableName: "vendor_varieties",
    recordId: "81913a7b-0b5a-42fe-8462-6ef016666db1",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "94930e35-0bb8-470e-9474-70b7878aeea9",
      varietyId: "31d3d2e6-6822-485d-afb6-9d4a0659e9c3",
      vendorName: "Jennifer Johnson",
      varietyName: "King David"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-16T20:57:17.827Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "3f878fa3-29c3-4ed5-ad1b-8efd0e6e31b0",
    tableName: "vendor_varieties",
    recordId: "ad80f1d1-8996-4974-8595-25c0cc479313",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "94930e35-0bb8-470e-9474-70b7878aeea9",
      varietyId: "42230ead-5cd8-400a-9f76-1ac3f46c092d",
      vendorName: "Jennifer Johnson",
      varietyName: "Misc."
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-16T20:57:36.312Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "50e510ef-1301-4d99-9a98-eed890826da7",
    tableName: "vendor_varieties",
    recordId: "34c0804d-2503-4d59-ae0b-48d374063bce",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "94930e35-0bb8-470e-9474-70b7878aeea9",
      varietyId: "7bf5e648-80dc-4b95-9188-96a9f3b5e020",
      vendorName: "Jennifer Johnson",
      varietyName: "Cortland"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-16T20:57:51.081Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "57233067-d304-4e17-a561-1b9b7168059e",
    tableName: "apple_varieties",
    recordId: "1568a026-2c50-41e5-b305-1ec448506f6c",
    operation: "create",
    oldData: null,
    newData: {
      name: "Red Gravenstein",
      varietyId: "1568a026-2c50-41e5-b305-1ec448506f6c"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-16T21:11:12.977Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "97bf507f-000c-4fca-9ca9-cb521d5424d3",
    tableName: "vendor_varieties",
    recordId: "7f95493f-aa98-4159-a9f3-9831f63494fd",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "94930e35-0bb8-470e-9474-70b7878aeea9",
      varietyId: "1568a026-2c50-41e5-b305-1ec448506f6c",
      vendorName: "Jennifer Johnson",
      varietyName: "Red Gravenstein"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-16T21:11:12.977Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "7af3458b-da27-490a-8c2a-551077591735",
    tableName: "apple_varieties",
    recordId: "8a92894c-4546-4ec9-88c3-98c06c9ad1e9",
    operation: "create",
    oldData: null,
    newData: {
      name: "Yellow Gravenstein",
      varietyId: "8a92894c-4546-4ec9-88c3-98c06c9ad1e9"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-16T21:12:21.708Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "9d0c5d57-23d1-4e4b-a241-ed03e34ca7c7",
    tableName: "vendor_varieties",
    recordId: "ff08d105-7577-4cf0-8e56-163a22d3999d",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "94930e35-0bb8-470e-9474-70b7878aeea9",
      varietyId: "8a92894c-4546-4ec9-88c3-98c06c9ad1e9",
      vendorName: "Jennifer Johnson",
      varietyName: "Yellow Gravenstein"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-16T21:12:21.708Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "99403235-a378-4e18-82bc-d7d2ae871814",
    tableName: "vendor_varieties",
    recordId: "cb702ef8-ee68-488c-a2fb-3aac73f864c7",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "c92137ad-19cd-43cf-9885-2426af8f8fff",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Cox’s Orange Pippin"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:19:58.009Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "4164d1e2-f191-4042-a695-57790124ab62",
    tableName: "vendor_varieties",
    recordId: "b7aefaae-681e-4efd-a2c8-389961d4a8ee",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "a4fd1763-15b0-4a01-a1d8-3f2fe9579b43",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Virginia Hewe’s Crab"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:20:06.950Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "d6006561-6780-4b2b-a995-81d02059610d",
    tableName: "vendor_varieties",
    recordId: "6841b031-34c0-4f8a-8265-8cb3e13739bd",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "b893d351-838d-43cd-9142-d3e4197605ac",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Muscat de Bernay"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:20:29.257Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "697bb6d0-d715-441f-a91f-a782464dfe3c",
    tableName: "vendor_varieties",
    recordId: "c4ea4dd9-a8a2-4e99-be39-c09ba670e4ba",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "bc0c5541-3978-4b88-9f3f-44bd6d0749ca",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Chisel Jersey"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:20:38.882Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "fbf89bc2-d079-4235-b7c8-d0ca54f5aef5",
    tableName: "vendor_varieties",
    recordId: "e51563e8-dd1e-437a-a94d-c97ed8df2053",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "c4fe50d3-17fe-4957-8cfb-31efc807eb11",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Yarlington Mill"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:21:21.462Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "ca683c2c-6e7f-4061-8f27-74b96036eab4",
    tableName: "vendor_varieties",
    recordId: "dcfb36b2-0c10-4200-a78c-c89d341ecc70",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "090cf903-7c45-4800-9ef2-c2a3ef6e53d5",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Arkansas Black"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:21:41.281Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "77a02bc5-f8b5-4b32-895f-ab6b89ce0215",
    tableName: "vendor_varieties",
    recordId: "ce33cf9d-e003-4d26-bc24-887d7101394c",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "3e443dce-dbbf-43ae-aaea-2c8e210d9381",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Golden Russet"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:21:51.730Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "80ce6959-51d9-41d7-9592-ac0748cb7779",
    tableName: "vendor_varieties",
    recordId: "c2bdcc24-b4e2-4805-b077-dd7b77ad3a80",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "57a36a0b-556e-4420-ae81-5437e7c2dd63",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Black Oxford"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:22:11.274Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "55ecab6c-6da1-40df-ba6c-513f9891b8e0",
    tableName: "vendor_varieties",
    recordId: "76bf0004-0b6d-4a69-974c-24039d7d9509",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "56cf352c-21f9-4174-adba-bc9a1420ee96",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Braeburn"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:22:45.424Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "9b7a841d-8fc5-4925-8a73-2498fd2b1c59",
    tableName: "apple_varieties",
    recordId: "33f33529-0d94-4ed8-8162-c4a54239a7ab",
    operation: "create",
    oldData: null,
    newData: {
      name: "Whitney Crab",
      varietyId: "33f33529-0d94-4ed8-8162-c4a54239a7ab"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:23:13.105Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "486b5187-75e8-431f-8d49-1b56973452d4",
    tableName: "vendor_varieties",
    recordId: "eb299cff-68a1-4a0b-ae7e-ec0a09c1a8c8",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "33f33529-0d94-4ed8-8162-c4a54239a7ab",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Whitney Crab"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:23:13.105Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "e5951226-0653-4ee2-8d79-b891107fefd9",
    tableName: "vendor_varieties",
    recordId: "4d35ddf1-ac8d-4c71-922f-a2669c57c892",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "752d2c5f-9693-485d-b13d-d6be8b45ba5f",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Amere de Berthcourt"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:23:27.414Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "ae2bee58-ce93-42ae-bd66-f97f65475646",
    tableName: "vendor_varieties",
    recordId: "2c7c6ce9-8eed-431f-9ac1-d5d446cb894f",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "2b4dde55-4df2-4154-b77d-612973a84104",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Harry Masters' Jersey"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:23:34.582Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "8b52febc-56d1-42f2-98f0-40d1477d3fe6",
    tableName: "vendor_varieties",
    recordId: "879e3196-2ff9-449e-a8c2-463e9cdbc63c",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "8053bfff-b26d-4b32-bac7-09e8abaae6fb",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Ashmead's Kernel"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:23:43.487Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "9eb1a5ed-adc9-47c6-a933-ed9420018d04",
    tableName: "apple_varieties",
    recordId: "8ecb9084-16de-45ee-8021-11f5b3173391",
    operation: "create",
    oldData: null,
    newData: {
      name: "Cimetere",
      varietyId: "8ecb9084-16de-45ee-8021-11f5b3173391"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:23:58.566Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "bb060b90-3d9e-4473-bdb2-58c2eec04678",
    tableName: "vendor_varieties",
    recordId: "6368bbe9-add7-4f53-913e-bd52fee3371b",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "8ecb9084-16de-45ee-8021-11f5b3173391",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Cimetere"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:23:58.566Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "5673df80-6a5d-401f-91d6-e9578f96e22b",
    tableName: "vendor_varieties",
    recordId: "cd3a3048-73e9-4da3-8092-3338d8d2d8ff",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "ef43b854-5e86-40cb-8070-1ddf645ae265",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Michelin"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:24:07.349Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "ce45caa3-290e-4e38-a3f8-c3526f7a9072",
    tableName: "vendor_varieties",
    recordId: "bb5c78d3-ae2c-42e8-981f-a94154aaff35",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "c1129869-91cc-4c9c-92a6-f7d72124f46d",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Tremlett's Bitter"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:24:19.769Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "0f51dfc9-c97f-4656-90b4-71f0347a543e",
    tableName: "vendor_varieties",
    recordId: "09cfed9d-4123-4e03-b239-3243abbdba52",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "ef99681d-597b-42a4-a6fe-53f174e05db1",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Tompkins King"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:24:34.904Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "94dd3925-4ef6-45d5-930c-68967f15dc1d",
    tableName: "vendor_varieties",
    recordId: "334af9b4-e56d-4944-b42d-eb7d65217db1",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "286a1c4c-a4d4-4e4c-b41c-e2fa8e6c7977",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Lambrook Pippin"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:24:45.704Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "abcc80e1-4449-459f-99c9-ad4f9235de08",
    tableName: "apple_varieties",
    recordId: "cff79bea-6d23-4b9f-a276-1c826564212a",
    operation: "create",
    oldData: null,
    newData: {
      name: "Belle de Jardin",
      varietyId: "cff79bea-6d23-4b9f-a276-1c826564212a"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:24:57.379Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "9c06121d-8e89-4651-a499-e22a1a93cee9",
    tableName: "vendor_varieties",
    recordId: "1c08482a-2207-47ae-ae1e-5847b7e41443",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "cff79bea-6d23-4b9f-a276-1c826564212a",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Belle de Jardin"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:24:57.379Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "6611cda4-40d0-4064-aedb-47b0de250491",
    tableName: "vendor_varieties",
    recordId: "3b7419f6-ed2d-448b-aef8-9656b49c5004",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "b7227f2b-b56e-4adb-9a01-eae6b8de0938",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Champlain"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:25:05.577Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "70d482d0-f021-49f4-a557-f478c6ca3bea",
    tableName: "vendor_varieties",
    recordId: "317b6682-3f20-4c22-a62a-06ca79aa361a",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "f0821ed3-cb8a-46fb-949e-5520719e0335",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Nehou"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:25:12.699Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "aacebc79-2805-49b4-a0e6-c6fb1c4dc829",
    tableName: "vendor_varieties",
    recordId: "49179477-c903-4620-b735-f61987649eff",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "8649f00a-40a8-4e42-8e0e-32bad2e741ad",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Red Vein Crab"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:25:19.688Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "96410796-68c4-4121-b656-b58d88a1a5a1",
    tableName: "vendor_varieties",
    recordId: "d3c8f954-199e-44ac-8eac-185c0138c41b",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "aa08eac0-a292-49f4-9250-332632913627",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Redfield"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:25:27.781Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "2751c147-4e45-47be-b574-93ddd95e9743",
    tableName: "vendor_varieties",
    recordId: "d3692756-7f6e-4a5d-9d2d-20ce077c6ea9",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "0b11de3b-e529-4af8-900d-15f847c5b5ab",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Isle of Wight Jersey"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:25:34.034Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "681e347f-89d5-4c3a-90fa-5e20e1e69de6",
    tableName: "vendor_varieties",
    recordId: "f37562b3-62e7-46a9-ba16-f63dde4c478a",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "fefcb992-b3d6-4b43-a794-ad07fbb74243",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Stoke Red"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:26:22.807Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "94f6f4ec-8a62-497d-9618-352525454907",
    tableName: "apple_varieties",
    recordId: "65cd1d01-7a18-44fd-96e2-d64ff97be7e7",
    operation: "create",
    oldData: null,
    newData: {
      name: "Dabinette",
      varietyId: "65cd1d01-7a18-44fd-96e2-d64ff97be7e7"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:26:35.352Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "62626544-1da6-4e0f-891e-b0fc58489fc7",
    tableName: "vendors",
    recordId: "b17536c5-a011-447b-be73-ca64196d8b96",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "b17536c5-a011-447b-be73-ca64196d8b96",
      vendorName: "David Brouchard"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T01:24:21.927Z",
    reason: null
  },
  {
    id: "fc597886-a134-40f8-92c0-69b0595161ea",
    tableName: "vendor_varieties",
    recordId: "30f53058-ef1f-4d3d-9041-35d10c0fdf61",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "65cd1d01-7a18-44fd-96e2-d64ff97be7e7",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Dabinette"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:26:35.352Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "f4b2c177-cc15-443a-9903-7fa6a6de9950",
    tableName: "vendor_varieties",
    recordId: "2721b4da-66ef-4209-93eb-8a36ea4a78d1",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "fc8570c7-5cf2-4ba2-a020-cfd011de62c6",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Harrison"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:26:42.828Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "71bdc069-eb9e-4b32-aaba-f70da10a1baa",
    tableName: "vendor_varieties",
    recordId: "8bfda4d5-4aa5-4638-9184-8775e39c553a",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "5555fdbf-37ed-4b11-8dd5-dcc9537dba59",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Kingston Black"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:26:52.244Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "94b6347f-4703-403f-bc24-eb5dc8de688d",
    tableName: "vendor_varieties",
    recordId: "4a1c3b83-d738-4b0e-8ac4-71dcc49d666f",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "05758cb3-2f81-46df-80ba-122d9ba25976",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Brown Snout"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:26:59.882Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "a2155037-d4fb-4403-9152-4c459b8b699a",
    tableName: "apple_varieties",
    recordId: "9f5f64f6-492a-443e-9763-4a3c0a9f8d8a",
    operation: "create",
    oldData: null,
    newData: {
      name: "Puget Spice",
      varietyId: "9f5f64f6-492a-443e-9763-4a3c0a9f8d8a"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:27:09.337Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "535904f6-edb1-493c-9ff3-8e9ea83dac87",
    tableName: "vendor_varieties",
    recordId: "33e6ace9-b57d-40a7-8ed9-d0bba4ac7696",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "9f5f64f6-492a-443e-9763-4a3c0a9f8d8a",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Puget Spice"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:27:09.337Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "0c9f479c-c42e-4c90-a1b3-94c4b1b32b02",
    tableName: "apple_varieties",
    recordId: "b4cdafe6-3c0f-4afb-b095-26d7da49ac80",
    operation: "create",
    oldData: null,
    newData: {
      name: "Antonovka",
      varietyId: "b4cdafe6-3c0f-4afb-b095-26d7da49ac80"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:27:26.118Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "be8333ed-0824-490c-a542-77b7780c9695",
    tableName: "vendor_varieties",
    recordId: "b226c4ab-f9ab-4666-9287-c4aab2f1746f",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "b4cdafe6-3c0f-4afb-b095-26d7da49ac80",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Antonovka"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:27:26.118Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "41aabf11-0271-4e21-adcf-9a0ce01957aa",
    tableName: "apple_varieties",
    recordId: "c8296719-1a94-44db-9ae3-20fbb274c702",
    operation: "create",
    oldData: null,
    newData: {
      name: "Dutchess of Oldenburg",
      varietyId: "c8296719-1a94-44db-9ae3-20fbb274c702"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:28:58.106Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "1fd362d5-f74c-4ce5-b580-b4acad281deb",
    tableName: "vendor_varieties",
    recordId: "303e4b32-52ca-4f5c-b9ba-b7942f1cfec3",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "c8296719-1a94-44db-9ae3-20fbb274c702",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Dutchess of Oldenburg"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:28:58.106Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "e2a0bc2d-35d2-4e0b-bc99-3ef76afcd706",
    tableName: "apple_varieties",
    recordId: "96b5c119-9cdf-446a-b9c2-9951a54bdcfb",
    operation: "create",
    oldData: null,
    newData: {
      name: "Karmijn de Sonneville",
      varietyId: "96b5c119-9cdf-446a-b9c2-9951a54bdcfb"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:29:12.289Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "0bd625d2-b6b7-4865-8139-f2cacb8cb6e8",
    tableName: "vendor_varieties",
    recordId: "3b5b0113-160f-4983-a4af-3620ba83091e",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "96b5c119-9cdf-446a-b9c2-9951a54bdcfb",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Karmijn de Sonneville"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:29:12.289Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "6276ecd1-afc4-4dfd-98b9-151fdd6de2c3",
    tableName: "apple_varieties",
    recordId: "44cef4db-0660-4340-96aa-420886799ba8",
    operation: "create",
    oldData: null,
    newData: {
      name: "Mountain Rose",
      varietyId: "44cef4db-0660-4340-96aa-420886799ba8"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:29:20.569Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "e7371139-20fa-42e5-9fb8-d57ba88afeeb",
    tableName: "vendor_varieties",
    recordId: "0c52e6be-a90d-487a-bbde-6e929db6064f",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "44cef4db-0660-4340-96aa-420886799ba8",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Mountain Rose"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:29:20.569Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "74e7f551-f52e-4258-927d-f0ba45028231",
    tableName: "vendor_varieties",
    recordId: "26b7e458-2c2d-4184-84c7-13aae2086b2e",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "1568a026-2c50-41e5-b305-1ec448506f6c",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Red Gravenstein"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:29:31.457Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "d889ecc9-513e-4085-aac9-9fb652acc13b",
    tableName: "apple_varieties",
    recordId: "b0449be6-7139-4260-bb55-4bd4c31aaac2",
    operation: "create",
    oldData: null,
    newData: {
      name: "Finn Hall Apple",
      varietyId: "b0449be6-7139-4260-bb55-4bd4c31aaac2"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:29:41.924Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "d01d6fd8-fd88-4712-86b7-f8be914566b1",
    tableName: "vendor_varieties",
    recordId: "01a33292-15af-47ad-9c1e-9edb5d21590e",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "b0449be6-7139-4260-bb55-4bd4c31aaac2",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Finn Hall Apple"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:29:41.924Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "d1586e93-018d-4eae-9843-4ab61a3b6b38",
    tableName: "apple_varieties",
    recordId: "66109f2d-663e-4662-b248-75038a0ca446",
    operation: "create",
    oldData: null,
    newData: {
      name: "Akane",
      varietyId: "66109f2d-663e-4662-b248-75038a0ca446"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:29:47.920Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "4ee90924-386f-4087-a9d6-0670fcf4caf4",
    tableName: "vendor_varieties",
    recordId: "ff2f90c1-ff7d-4f62-b262-ae614f2a0b02",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "66109f2d-663e-4662-b248-75038a0ca446",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Akane"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:29:47.920Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "27ccdca7-c497-49f3-9fea-ae9eacb720f7",
    tableName: "vendor_varieties",
    recordId: "fcf53604-8c4a-487f-9da2-d28fa7974a59",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "c92137ad-19cd-43cf-9885-2426af8f8fff",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Cox’s Orange Pippin"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:29:55.178Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "2be3ff48-ea0b-468b-ae46-558cc450282a",
    tableName: "apple_varieties",
    recordId: "6977747f-494a-4d7e-a860-da9a34531ff4",
    operation: "create",
    oldData: null,
    newData: {
      name: "Sops of Wine",
      varietyId: "6977747f-494a-4d7e-a860-da9a34531ff4"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:30:03.825Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "2e7d2095-759e-4eed-8e3c-4d8d8ef1ee85",
    tableName: "vendor_varieties",
    recordId: "b19a6042-bda5-434e-8a4b-ab0226a7d6ad",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "6977747f-494a-4d7e-a860-da9a34531ff4",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Sops of Wine"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:30:03.825Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "377a9465-773a-477e-8389-cb6cc9708388",
    tableName: "apple_varieties",
    recordId: "a052e239-0b68-4537-8c65-13bc930e6e5e",
    operation: "create",
    oldData: null,
    newData: {
      name: "Reine de Rinette",
      varietyId: "a052e239-0b68-4537-8c65-13bc930e6e5e"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:30:11.335Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "239fee35-f3e2-4115-8f45-1a7cab3adcd5",
    tableName: "vendor_varieties",
    recordId: "9a0aa108-7268-437c-951b-4412e8cbab2c",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "a052e239-0b68-4537-8c65-13bc930e6e5e",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Reine de Rinette"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:30:11.335Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "f68f8b88-cec7-4499-ad46-a37ae05a9f78",
    tableName: "vendor_varieties",
    recordId: "a156cf77-2d72-4d92-b6f9-95dcc8d7d2e5",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "6ab92f47-2cde-4dcd-9050-3e2f8e7e5777",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Honeycrisp"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:30:18.216Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "55d95ed8-b950-424c-9958-c0389800fc26",
    tableName: "apple_varieties",
    recordId: "600c28bd-b9ad-4d80-b0ed-58693f6b1092",
    operation: "create",
    oldData: null,
    newData: {
      name: "Cosmic Crisp",
      varietyId: "600c28bd-b9ad-4d80-b0ed-58693f6b1092"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:30:29.775Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "729a4c4b-4df7-4fb9-a5e7-0cc6e08b17e1",
    tableName: "vendor_varieties",
    recordId: "5efdbc8b-3936-429e-b471-651efdc18f15",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "600c28bd-b9ad-4d80-b0ed-58693f6b1092",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Cosmic Crisp"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:30:29.775Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "d0c1f6ec-afa7-4c60-a980-714efe628254",
    tableName: "vendor_varieties",
    recordId: "ecb079a7-9d50-4bc8-8597-39d0c9dff611",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "c4fe50d3-17fe-4957-8cfb-31efc807eb11",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Yarlington Mill"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:30:40.704Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "8ec283e9-0a7d-478c-834c-b8ee216c3c94",
    tableName: "apple_varieties",
    recordId: "a8de7dbf-bcb0-4cbc-93bc-8bacd2caa2a7",
    operation: "create",
    oldData: null,
    newData: {
      name: "Bolero",
      varietyId: "a8de7dbf-bcb0-4cbc-93bc-8bacd2caa2a7"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:30:47.267Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "e4523ff0-47e0-4757-aae2-b2762e90e4a0",
    tableName: "vendor_varieties",
    recordId: "a2eeb87d-115e-473f-8662-fdb4bb469141",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "a8de7dbf-bcb0-4cbc-93bc-8bacd2caa2a7",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Bolero"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:30:47.267Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "82d080b0-9ada-4e42-ad2e-06b93a1f0758",
    tableName: "vendor_varieties",
    recordId: "80d3cdae-7da5-4b08-8bd3-c8a70651a66d",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "0ce26eb8-c248-4610-91cd-2fbbe5ea8998",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Liberty"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:30:52.891Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "4bbf2bfe-49be-4814-ad2e-512c16926960",
    tableName: "vendor_varieties",
    recordId: "bb760f53-294a-4661-bc2e-cd60ee71589c",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "5555fdbf-37ed-4b11-8dd5-dcc9537dba59",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Kingston Black"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:31:01.266Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "d1e3a972-c3ee-4dce-bd6d-e018ac7b4ea3",
    tableName: "vendor_varieties",
    recordId: "c095e500-a61a-415b-a8d1-fbad0918a12a",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "8053bfff-b26d-4b32-bac7-09e8abaae6fb",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Ashmead's Kernel"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:31:08.969Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "1ac999c3-8c5a-4784-8e85-cc06387425f9",
    tableName: "vendor_varieties",
    recordId: "000141dd-eb9c-4408-ac8a-87b288870b91",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "00cdb8ec-067b-4559-9184-a984dfcca726",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Enterprise"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:31:15.576Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "805ae4c5-592f-4209-98d4-0faeeb707a1c",
    tableName: "vendor_varieties",
    recordId: "1eaf4cbe-ec4a-4a31-82e4-a20634345088",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "de6a0f3b-2b6f-464c-8ea6-329d0530aa4f",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Jonagold"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:31:22.309Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "38ae8a32-bd23-4d4d-ab89-861471b55d98",
    tableName: "vendor_varieties",
    recordId: "0b0906ec-346f-4b1b-8fbd-9080c2f86b41",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "72e3faf6-9625-4fe6-8498-e275efdd0d47",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Dabinett"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:31:33.827Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "9f4cd80f-7d42-4732-bed8-dfa1f680f590",
    tableName: "vendor_varieties",
    recordId: "7366dada-c139-4a81-96ea-80e1d800437d",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "fc8570c7-5cf2-4ba2-a020-cfd011de62c6",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Harrison"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:31:39.216Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "6216345c-a07a-45ab-9410-89c20253b7f5",
    tableName: "vendor_varieties",
    recordId: "afe2a73b-64ad-4c24-a4aa-1836f80b65dc",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "9f5f64f6-492a-443e-9763-4a3c0a9f8d8a",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Puget Spice"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:31:44.877Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "22b96bf2-cd3e-4a79-bb7b-8bf1e04ffad5",
    tableName: "vendor_varieties",
    recordId: "d7022392-4c64-4228-b13b-a68dc6307f16",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "3e443dce-dbbf-43ae-aaea-2c8e210d9381",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Golden Russet"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:31:50.109Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "d14be9dc-bc52-40c6-b153-11e9fe63b9ad",
    tableName: "apple_varieties",
    recordId: "058346fe-88b1-4607-8744-090995e2a2bc",
    operation: "create",
    oldData: null,
    newData: {
      name: "Cinnamon Spice",
      varietyId: "058346fe-88b1-4607-8744-090995e2a2bc"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:32:13.744Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "3fa63098-e75e-48e7-83ee-97542c8176a2",
    tableName: "vendor_varieties",
    recordId: "29f2d650-6517-48bb-a7af-cdfcdbf14ec8",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "058346fe-88b1-4607-8744-090995e2a2bc",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Cinnamon Spice"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:32:13.744Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "660f3d2c-39cb-4c58-8562-7105af8060db",
    tableName: "apple_varieties",
    recordId: "906cd00c-a8b0-4b77-be72-b65a521af440",
    operation: "create",
    oldData: null,
    newData: {
      name: "Burford Red",
      varietyId: "906cd00c-a8b0-4b77-be72-b65a521af440"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:32:20.881Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "0edbb606-c717-4acf-bd14-fd8d673e150e",
    tableName: "vendor_varieties",
    recordId: "b9a96cee-f2d1-44ad-838a-b5818a5b6c6b",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "906cd00c-a8b0-4b77-be72-b65a521af440",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Burford Red"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:32:20.881Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "30240117-f953-4beb-a0be-4ce93985a373",
    tableName: "vendor_varieties",
    recordId: "556e71a8-5f8b-47f7-80f2-ab8476ff8d6c",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "aa08eac0-a292-49f4-9250-332632913627",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Redfield"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:32:26.214Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "4260664c-8177-41eb-a71a-8d841e29885e",
    tableName: "apple_varieties",
    recordId: "1f88a182-c808-460f-9a0d-b20eb7385317",
    operation: "create",
    oldData: null,
    newData: {
      name: "Geneva Crab",
      varietyId: "1f88a182-c808-460f-9a0d-b20eb7385317"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:32:36.401Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "8f4484c9-532e-4746-b08a-63f36090002f",
    tableName: "vendor_varieties",
    recordId: "784ba519-91ea-41fe-a82b-e91765f7f86c",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "1f88a182-c808-460f-9a0d-b20eb7385317",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Geneva Crab"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:32:36.401Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "e384db84-ec7b-42f4-ae1d-d268f1a77176",
    tableName: "apple_varieties",
    recordId: "305acd9d-2e28-4c77-b58c-91407befc154",
    operation: "create",
    oldData: null,
    newData: {
      name: "Nieekyma",
      varietyId: "305acd9d-2e28-4c77-b58c-91407befc154"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:32:55.050Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "ff808986-58ba-4d99-af66-288b2832f51c",
    tableName: "vendor_varieties",
    recordId: "37e959eb-c5cc-4b3d-93c9-1881d77d6b9b",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "305acd9d-2e28-4c77-b58c-91407befc154",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Nieekyma"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:32:55.050Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "de9b14d9-2440-4732-8be8-6d279dc6041d",
    tableName: "vendor_varieties",
    recordId: "30f53058-ef1f-4d3d-9041-35d10c0fdf61",
    operation: "delete",
    oldData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "65cd1d01-7a18-44fd-96e2-d64ff97be7e7",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Dabinette"
    },
    newData: {
      deletedAt: "2025-09-17T15:33:12.809Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:33:12.799Z",
    reason: "Vendor-variety link removed via API"
  },
  {
    id: "fa7fb165-34a3-42ef-9355-8b506ab27605",
    tableName: "vendor_varieties",
    recordId: "210d8fc5-ea16-4c74-abfd-44af4861e0d0",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "72e3faf6-9625-4fe6-8498-e275efdd0d47",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Dabinett"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:33:18.872Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "692e2312-715c-4cb3-bc62-dc3ecc1a3623",
    tableName: "apple_varieties",
    recordId: "58cb540e-e19b-4e9e-ac44-7f07ea1ca797",
    operation: "create",
    oldData: null,
    newData: {
      name: "Farm House Misc",
      varietyId: "58cb540e-e19b-4e9e-ac44-7f07ea1ca797"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:49:41.239Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "99ab19f7-664d-4ba2-9ab3-bb5f58a3b5e2",
    tableName: "vendor_varieties",
    recordId: "fac709ee-5e05-4f37-91cf-a13a667a8834",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "3d7ddcec-b833-4d4b-9cba-2c604adf5a4c",
      varietyId: "58cb540e-e19b-4e9e-ac44-7f07ea1ca797",
      vendorName: "Scott and Ginger Wierzbanowski (Farm House)",
      varietyName: "Farm House Misc"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:49:41.239Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "988adf8d-e7f2-48a3-ae0a-e7c5e50a4040",
    tableName: "apple_varieties",
    recordId: "46ad4a95-739d-4a72-aceb-4338d1d88176",
    operation: "create",
    oldData: null,
    newData: {
      name: "OBC Misc",
      varietyId: "46ad4a95-739d-4a72-aceb-4338d1d88176"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:49:53.858Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "2e2ef7f3-3b60-4944-a74b-f15fe99443a7",
    tableName: "vendor_varieties",
    recordId: "40d37a6d-1d10-4482-87ed-3528a3e0cc50",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "46ad4a95-739d-4a72-aceb-4338d1d88176",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "OBC Misc"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-17T15:49:53.858Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "a806c075-f232-4402-8cf5-529d5e5600fe",
    tableName: "vendors",
    recordId: "328f5491-f41e-4ac7-a0dd-b60592ea4145",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "328f5491-f41e-4ac7-a0dd-b60592ea4145",
      vendorName: "Richard"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T00:30:40.741Z",
    reason: null
  },
  {
    id: "6e4a1a75-7064-4997-be6b-f33c16534132",
    tableName: "vendor_varieties",
    recordId: "b932c1db-9e9b-49f3-8515-30324d7fee1f",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "328f5491-f41e-4ac7-a0dd-b60592ea4145",
      varietyId: "42230ead-5cd8-400a-9f76-1ac3f46c092d",
      vendorName: "Richard",
      varietyName: "Misc."
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T00:31:01.857Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "f077e004-df69-4f34-8d76-5832d4d1f08d",
    tableName: "vendor_varieties",
    recordId: "0114efb6-a9b2-4f40-aa25-2a8eaa1fada0",
    operation: "delete",
    oldData: {
      vendorId: "def086e4-81d5-4916-94e2-366aad247a42",
      varietyId: "50d69a34-c8c8-42b9-b9e1-dddc6b329485",
      vendorName: "Bob and Sally Rodgers",
      varietyName: "Northern Spy"
    },
    newData: {
      deletedAt: "2025-09-18T00:31:39.703Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T00:31:39.693Z",
    reason: "Vendor-variety link removed via API"
  },
  {
    id: "0345fdbb-872f-4094-9cc0-aedadc5e9627",
    tableName: "vendor_varieties",
    recordId: "626c1ba8-75b4-411b-b23c-986037d7596a",
    operation: "delete",
    oldData: {
      vendorId: "def086e4-81d5-4916-94e2-366aad247a42",
      varietyId: "2141f56d-0e45-4d37-b7b5-0e36082a75f9",
      vendorName: "Bob and Sally Rodgers",
      varietyName: "Gala"
    },
    newData: {
      deletedAt: "2025-09-18T00:33:39.775Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T00:33:39.769Z",
    reason: "Vendor-variety link removed via API"
  },
  {
    id: "3482cbf4-22b2-4241-ab50-c9aff29db2d7",
    tableName: "apple_varieties",
    recordId: "926a783c-8910-4099-967a-00a36010ecd9",
    operation: "create",
    oldData: null,
    newData: {
      name: "Chehalis",
      varietyId: "926a783c-8910-4099-967a-00a36010ecd9"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T00:34:24.763Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "2c150e4e-8a7c-45e9-819f-8e618a0bf3dd",
    tableName: "vendor_varieties",
    recordId: "3eb7ad57-e335-42b1-87dc-9b3d86d1a851",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "def086e4-81d5-4916-94e2-366aad247a42",
      varietyId: "926a783c-8910-4099-967a-00a36010ecd9",
      vendorName: "Bob and Sally Rodgers",
      varietyName: "Chehalis"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T00:34:24.763Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "ec1f7bc4-79f6-4f6e-9585-112f816a0a89",
    tableName: "vendor_varieties",
    recordId: "fa695ea1-1c0d-4ba8-bf38-cb67459cf8de",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "def086e4-81d5-4916-94e2-366aad247a42",
      varietyId: "72aef0a9-851a-4087-a287-b61b41256de8",
      vendorName: "Bob and Sally Rodgers",
      varietyName: "Gravenstein"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T00:34:38.084Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "317d374f-fb5a-4fad-8eee-94f819d677e6",
    tableName: "apple_varieties",
    recordId: "9bc01234-1cf3-42ea-9e12-d0e9d357c094",
    operation: "create",
    oldData: null,
    newData: {
      name: "Melrose",
      varietyId: "9bc01234-1cf3-42ea-9e12-d0e9d357c094"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T00:34:53.321Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "5fb4bb73-7918-449f-8054-193da211e9e2",
    tableName: "vendor_varieties",
    recordId: "13eba5ee-cbbe-4ceb-989f-17a685f6b637",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "def086e4-81d5-4916-94e2-366aad247a42",
      varietyId: "9bc01234-1cf3-42ea-9e12-d0e9d357c094",
      vendorName: "Bob and Sally Rodgers",
      varietyName: "Melrose"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T00:34:53.321Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "5b6418cc-a50a-4f8f-bee1-8d4513181050",
    tableName: "vendor_varieties",
    recordId: "ae3408ce-1e91-4e6e-8aaf-eb212a4d44b9",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "def086e4-81d5-4916-94e2-366aad247a42",
      varietyId: "42230ead-5cd8-400a-9f76-1ac3f46c092d",
      vendorName: "Bob and Sally Rodgers",
      varietyName: "Misc."
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T00:35:07.519Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "d8db87fe-7a11-455b-8f6c-76d0376b2b25",
    tableName: "vendors",
    recordId: "76cdfe10-90b1-4b6a-b185-660c256bff1e",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "76cdfe10-90b1-4b6a-b185-660c256bff1e",
      vendorName: "Jean and Jerry"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T01:15:15.369Z",
    reason: null
  },
  {
    id: "5608f938-fb0b-43e6-954e-b3953090cd58",
    tableName: "vendor_varieties",
    recordId: "c20bfc73-93f1-4e0c-8e9c-3dfae697532e",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "76cdfe10-90b1-4b6a-b185-660c256bff1e",
      varietyId: "42230ead-5cd8-400a-9f76-1ac3f46c092d",
      vendorName: "Jean and Jerry",
      varietyName: "Misc."
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T01:15:59.405Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "4415a4c5-d510-48f2-9f80-cf9a56788d34",
    tableName: "vendor_varieties",
    recordId: "312e6a0f-6257-45c0-b853-3babccde6f40",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "76cdfe10-90b1-4b6a-b185-660c256bff1e",
      varietyId: "72aef0a9-851a-4087-a287-b61b41256de8",
      vendorName: "Jean and Jerry",
      varietyName: "Gravenstein"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T01:16:05.721Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "d69f954b-4a3e-45fc-8334-3c9616195a3e",
    tableName: "vendors",
    recordId: "76cdfe10-90b1-4b6a-b185-660c256bff1e",
    operation: "update",
    oldData: {
      id: "76cdfe10-90b1-4b6a-b185-660c256bff1e",
      name: "Jean and Jerry",
      isActive: true,
      createdAt: "2025-09-18T01:15:15.334Z",
      deletedAt: null,
      updatedAt: "2025-09-18T01:15:15.334Z",
      contactInfo: null
    },
    newData: {
      name: "Jean and Jerry Christensen",
      contactInfo: {
        phone: "2535094681",
        address: "Runnion Rd, Sequim, WA 98362"
      }
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T01:16:53.226Z",
    reason: null
  },
  {
    id: "5895c63f-d894-4557-a10d-1968efd1f2c2",
    tableName: "vendor_varieties",
    recordId: "f3e1c574-f0e5-4efb-936a-b27bd88530f8",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "2408ce9f-fdb2-45fe-9b87-49922ca151d5",
      varietyId: "42230ead-5cd8-400a-9f76-1ac3f46c092d",
      vendorName: "Rob & Dana Middleton",
      varietyName: "Misc."
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T01:20:50.771Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "c59854bd-5567-4827-925f-52dd7fcb15ec",
    tableName: "vendor_varieties",
    recordId: "38a45585-0024-4e30-b712-5124ddc66450",
    operation: "delete",
    oldData: {
      vendorId: "2408ce9f-fdb2-45fe-9b87-49922ca151d5",
      varietyId: "40a3bdf8-90ad-4ec3-8911-1aea5f5aec7d",
      vendorName: "Rob & Dana Middleton",
      varietyName: "Granny Smith"
    },
    newData: {
      deletedAt: "2025-09-18T01:20:56.028Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T01:20:55.996Z",
    reason: "Vendor-variety link removed via API"
  },
  {
    id: "abfa9b66-50a5-4ba0-8236-3d15db16be59",
    tableName: "vendors",
    recordId: "7b8459d7-637b-4cf1-a3c1-f28cef221f04",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "7b8459d7-637b-4cf1-a3c1-f28cef221f04",
      vendorName: "Inn Orchard"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T01:21:46.693Z",
    reason: null
  },
  {
    id: "64bbfd3a-236e-4610-9218-ffa0002b1bf7",
    tableName: "vendor_varieties",
    recordId: "2e255f98-6d23-4b54-9a97-fe98f60d2173",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "7b8459d7-637b-4cf1-a3c1-f28cef221f04",
      varietyId: "42230ead-5cd8-400a-9f76-1ac3f46c092d",
      vendorName: "Inn Orchard",
      varietyName: "Misc."
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T01:21:56.196Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "57e65cfd-7892-4a92-b65c-1e12e981f695",
    tableName: "vendor_varieties",
    recordId: "7636bf82-64f1-4b77-93aa-79fca60abeb4",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "b17536c5-a011-447b-be73-ca64196d8b96",
      varietyId: "42230ead-5cd8-400a-9f76-1ac3f46c092d",
      vendorName: "David Brouchard",
      varietyName: "Misc."
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T01:24:32.239Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "36076766-a728-4908-82b2-434f3f15de4f",
    tableName: "vendors",
    recordId: "6b883a1b-45eb-48b8-82af-a3091c31af01",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "6b883a1b-45eb-48b8-82af-a3091c31af01",
      vendorName: "Jennifer"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T01:26:42.396Z",
    reason: null
  },
  {
    id: "1b965f02-c5f2-43f2-972b-a22a06c7d05b",
    tableName: "vendor_varieties",
    recordId: "f382b87c-7279-42b6-a33d-52f3708bd5ff",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "6b883a1b-45eb-48b8-82af-a3091c31af01",
      varietyId: "42230ead-5cd8-400a-9f76-1ac3f46c092d",
      vendorName: "Jennifer",
      varietyName: "Misc."
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T01:26:53.054Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "33158c58-ce1e-42db-95c5-3741693e661d",
    tableName: "vendor_varieties",
    recordId: "cd94d275-bbf7-462a-ab7e-56ae4ed0b9c6",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "72c5dac5-2978-4b22-a69d-0d23a23c9590",
      varietyId: "42230ead-5cd8-400a-9f76-1ac3f46c092d",
      vendorName: "Carlos Murrugarra",
      varietyName: "Misc."
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T01:30:57.346Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "a783b4c4-847e-47f2-acc7-eb121c7d9a02",
    tableName: "vendors",
    recordId: "71d92e71-cdc1-4171-85ca-d67253554cd7",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "71d92e71-cdc1-4171-85ca-d67253554cd7",
      vendorName: "Community Press"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T02:40:40.767Z",
    reason: null
  },
  {
    id: "4d87458a-635e-4c18-9810-ffc54e2619d8",
    tableName: "vendor_varieties",
    recordId: "bb3b5726-9d33-418d-8ac7-44bd2b780388",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "71d92e71-cdc1-4171-85ca-d67253554cd7",
      varietyId: "42230ead-5cd8-400a-9f76-1ac3f46c092d",
      vendorName: "Community Press",
      varietyName: "Misc."
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T02:40:51.828Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "6e318d29-51bc-46c4-a53c-2e188eafa418",
    tableName: "vendors",
    recordId: "58c64709-0a1b-47d5-849a-0bece8cfa7cf",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "58c64709-0a1b-47d5-849a-0bece8cfa7cf",
      vendorName: "Terry and Amy Anderson"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T02:44:48.450Z",
    reason: null
  },
  {
    id: "0bc1fb5d-54bf-4163-96f5-b6ed08ffb3a2",
    tableName: "vendors",
    recordId: "58c64709-0a1b-47d5-849a-0bece8cfa7cf",
    operation: "update",
    oldData: {
      id: "58c64709-0a1b-47d5-849a-0bece8cfa7cf",
      name: "Terry and Amy Anderson",
      isActive: true,
      createdAt: "2025-09-18T02:44:48.443Z",
      deletedAt: null,
      updatedAt: "2025-09-18T02:44:48.443Z",
      contactInfo: null
    },
    newData: {
      name: "Terry and Amy Anderson",
      contactInfo: {}
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T02:45:55.997Z",
    reason: null
  },
  {
    id: "431cc459-ecbb-4fba-b9bf-4828acf9dab5",
    tableName: "vendor_varieties",
    recordId: "f441d4a5-fba6-43dc-9953-e7eaf9fd0622",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "58c64709-0a1b-47d5-849a-0bece8cfa7cf",
      varietyId: "42230ead-5cd8-400a-9f76-1ac3f46c092d",
      vendorName: "Terry and Amy Anderson",
      varietyName: "Misc."
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T15:14:25.151Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "8eb30ce5-8e80-45b0-aa5f-8beaca42a28c",
    tableName: "vendor_varieties",
    recordId: "1064fed6-3268-41a8-a248-f879e951419d",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "925595a1-1171-4947-88d0-d4242fc0345d",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Ben Davis"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T15:15:39.553Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "f6fa3a0c-e855-49e8-b7ee-72a5ae0aa6c5",
    tableName: "vendor_varieties",
    recordId: "7d508732-e795-47a9-a92b-9aadc9da9f7b",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "69834f95-ee70-47cc-bfa4-ae09abfa7e6f",
      varietyId: "9bc01234-1cf3-42ea-9e12-d0e9d357c094",
      vendorName: "Lazy J (Steve Johnson)",
      varietyName: "Melrose"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T15:16:32.252Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "f8229127-7617-46b3-b045-d3b6ddc867bd",
    tableName: "vendor_varieties",
    recordId: "34f99ed4-812e-4782-b97a-9eb4c50896a5",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "69834f95-ee70-47cc-bfa4-ae09abfa7e6f",
      varietyId: "f0821ed3-cb8a-46fb-949e-5520719e0335",
      vendorName: "Lazy J (Steve Johnson)",
      varietyName: "Nehou"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T15:16:42.613Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "d4fc2904-c747-490d-be7f-63710fe3665b",
    tableName: "vendor_varieties",
    recordId: "86a5a4b6-89b7-41c6-8322-8b90c30dfaa0",
    operation: "delete",
    oldData: {
      vendorId: "9f379c32-97d9-4aa3-b09e-e6845ca48f43",
      varietyId: "50d69a34-c8c8-42b9-b9e1-dddc6b329485",
      vendorName: "Denver Vaughn",
      varietyName: "Northern Spy"
    },
    newData: {
      deletedAt: "2025-09-18T15:20:21.722Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T15:20:21.713Z",
    reason: "Vendor-variety link removed via API"
  },
  {
    id: "53df4945-39c8-4191-8eb3-a2e9bdb8f080",
    tableName: "apple_varieties",
    recordId: "27d6a3fa-6131-49ac-b49a-eff95621bb3a",
    operation: "create",
    oldData: null,
    newData: {
      name: "bitter pear",
      varietyId: "27d6a3fa-6131-49ac-b49a-eff95621bb3a"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T15:22:07.720Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "8df9290f-bbc2-4154-afb4-6835ee368aff",
    tableName: "vendor_varieties",
    recordId: "146fcf9a-ac27-49c6-91ba-353772dfda52",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "9f379c32-97d9-4aa3-b09e-e6845ca48f43",
      varietyId: "27d6a3fa-6131-49ac-b49a-eff95621bb3a",
      vendorName: "Denver Vaughn",
      varietyName: "bitter pear"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T15:22:07.720Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "844c4d6f-2181-4cde-9eb0-d568994618dc",
    tableName: "vendor_varieties",
    recordId: "51cf9251-461d-42b9-aafa-090613b5d8dd",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "69834f95-ee70-47cc-bfa4-ae09abfa7e6f",
      varietyId: "42230ead-5cd8-400a-9f76-1ac3f46c092d",
      vendorName: "Lazy J (Steve Johnson)",
      varietyName: "Misc."
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T15:25:44.820Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "774ca9c2-9225-4001-b3dd-df734c882bf7",
    tableName: "apple_varieties",
    recordId: "a4fc827e-1849-478e-ac07-67b453af0173",
    operation: "create",
    oldData: null,
    newData: {
      name: "Row 5",
      varietyId: "a4fc827e-1849-478e-ac07-67b453af0173"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T15:34:36.677Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "e773a522-75b9-460a-a8d4-a40281449cb5",
    tableName: "vendor_varieties",
    recordId: "abb2f78e-e7d3-4fc1-8b44-13497cfd4939",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "07888833-40b3-4eb8-8cc7-99b9d339dee5",
      varietyId: "a4fc827e-1849-478e-ac07-67b453af0173",
      vendorName: "Olympic Bluff Cidery",
      varietyName: "Row 5"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T15:34:36.677Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "ee3cbcb5-3f66-45d5-a968-42d41997662a",
    tableName: "vendor_varieties",
    recordId: "d7bcf76e-8235-47bb-81be-158762b8baf8",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "69834f95-ee70-47cc-bfa4-ae09abfa7e6f",
      varietyId: "22eccb6b-9fad-4550-9581-6fefc5c52e46",
      vendorName: "Lazy J (Steve Johnson)",
      varietyName: "Golden Delicious"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T15:55:00.859Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "0753462a-65c2-46ab-9323-5ef5801c105f",
    tableName: "vendor_varieties",
    recordId: "9c72f176-839b-4614-8b36-be20e78c0477",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "def086e4-81d5-4916-94e2-366aad247a42",
      varietyId: "2ee958b6-92d9-4458-af88-4a708fdeb55c",
      vendorName: "Bob and Sally Rodgers",
      varietyName: "Winesap"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-18T15:59:26.022Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "9f1a6454-39d9-45a0-9aa2-194a5da772f6",
    tableName: "vendors",
    recordId: "ed1de8a1-fada-43ae-a4b4-4527fd286b28",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "ed1de8a1-fada-43ae-a4b4-4527fd286b28",
      vendorName: "Test Flow"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-20T05:25:28.582Z",
    reason: null
  },
  {
    id: "476d316a-7054-49a6-a391-47d7b3fa57af",
    tableName: "base_fruit_varieties",
    recordId: "1199a7e9-3623-4161-8fbe-570713cfb9be",
    operation: "create",
    oldData: null,
    newData: {
      name: "Test Apple",
      varietyId: "1199a7e9-3623-4161-8fbe-570713cfb9be"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-20T05:27:02.929Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "36f4bce7-a73e-48c9-990f-ecfa599870db",
    tableName: "vendor_varieties",
    recordId: "73c34852-fda2-4cbc-8ed0-8817b6456ba5",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "ed1de8a1-fada-43ae-a4b4-4527fd286b28",
      varietyId: "1199a7e9-3623-4161-8fbe-570713cfb9be",
      vendorName: "Test Flow",
      varietyName: "Test Apple"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-20T05:27:02.929Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "5b2c6d05-82c4-4cb8-8ea0-e27481c709eb",
    tableName: "vendors",
    recordId: "ed1de8a1-fada-43ae-a4b4-4527fd286b28",
    operation: "update",
    oldData: {
      id: "ed1de8a1-fada-43ae-a4b4-4527fd286b28",
      name: "Test Flow",
      isActive: true,
      createdAt: "2025-09-20T05:25:28.326Z",
      deletedAt: null,
      updatedAt: "2025-09-20T05:25:28.326Z",
      contactInfo: null
    },
    newData: {
      name: "Test Vendor",
      contactInfo: {}
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-20T05:27:19.827Z",
    reason: null
  },
  {
    id: "ec6037f4-d179-4fab-9bd8-6f4c41279f58",
    tableName: "base_fruit_varieties",
    recordId: "93b4097e-5be2-428d-a0ed-a1b9e4cdf361",
    operation: "create",
    oldData: null,
    newData: {
      name: "Test Apple 2",
      varietyId: "93b4097e-5be2-428d-a0ed-a1b9e4cdf361"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-20T18:24:52.543Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "9c3b6edc-18e0-44fa-b709-2a452c64ec5a",
    tableName: "vendor_varieties",
    recordId: "38f7e83a-47e4-4572-abf6-9abf1818b7fb",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "ed1de8a1-fada-43ae-a4b4-4527fd286b28",
      varietyId: "93b4097e-5be2-428d-a0ed-a1b9e4cdf361",
      vendorName: "Test Vendor",
      varietyName: "Test Apple 2"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-20T18:24:52.543Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "7aa1cf84-1f9c-406f-ae70-006d620b138c",
    tableName: "base_fruit_varieties",
    recordId: "0df36596-7c86-4e96-82f9-ee2d9db115af",
    operation: "create",
    oldData: null,
    newData: {
      name: "Wagener",
      varietyId: "0df36596-7c86-4e96-82f9-ee2d9db115af"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-22T18:55:15.274Z",
    reason: "Auto-created when linking to vendor"
  },
  {
    id: "dcd60692-f06d-460e-b818-5203e4c897ff",
    tableName: "vendor_varieties",
    recordId: "17360ac0-1e2e-4a6c-a81b-bec8a9e8765a",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "ca9a69d1-ac63-4a96-98db-8bd5db6d18bc",
      varietyId: "0df36596-7c86-4e96-82f9-ee2d9db115af",
      vendorName: "Mick",
      varietyName: "Wagener"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-22T18:55:15.274Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "e24f4a28-5005-4bad-9d51-24a7cd41932c",
    tableName: "vendor_varieties",
    recordId: "e3e74fec-8b30-42e5-bedd-1eaa571ac6f1",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "def086e4-81d5-4916-94e2-366aad247a42",
      varietyId: "070edf52-416f-4160-8459-05c6fc1e4818",
      vendorName: "Bob and Sally Rodgers",
      varietyName: "Italian Plum"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-22T21:14:05.824Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "e53d9b1e-770a-4cb9-acc4-54666fd398e8",
    tableName: "vendor_varieties",
    recordId: "e1cbe79a-e928-4855-ab3c-09f73b4eae58",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "28948ea1-20ce-4335-ba07-d1400a60732d",
      varietyId: "72aef0a9-851a-4087-a287-b61b41256de8",
      vendorName: "Victor Gonzalez",
      varietyName: "Gravenstein"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-23T03:35:42.309Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "6d2ba009-6943-47aa-ba83-e2746aa933e7",
    tableName: "vendor_varieties",
    recordId: "16a12cd8-88fa-40cc-9937-758eda3ebfbf",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "28948ea1-20ce-4335-ba07-d1400a60732d",
      varietyId: "1568a026-2c50-41e5-b305-1ec448506f6c",
      vendorName: "Victor Gonzalez",
      varietyName: "Red Gravenstein"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-23T03:35:51.464Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "792384dd-6da5-4bea-a0d2-d70d0c3dda41",
    tableName: "vendor_varieties",
    recordId: "2fd699a4-83b2-4b49-b9c3-21938df4ddbc",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "2408ce9f-fdb2-45fe-9b87-49922ca151d5",
      varietyId: "926a783c-8910-4099-967a-00a36010ecd9",
      vendorName: "Rob & Dana Middleton",
      varietyName: "Chehalis"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-23T03:39:32.650Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "854c56de-c909-45e2-b90d-4c88ada4380d",
    tableName: "vendor_varieties",
    recordId: "564b0f91-1e1f-45b4-8895-67234aa11f88",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "2408ce9f-fdb2-45fe-9b87-49922ca151d5",
      varietyId: "72aef0a9-851a-4087-a287-b61b41256de8",
      vendorName: "Rob & Dana Middleton",
      varietyName: "Gravenstein"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-23T03:39:39.719Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "92d95f64-d93a-47c9-95d9-47db6c4fb4c5",
    tableName: "vendors",
    recordId: "d3248bd1-20d9-45ae-9f7d-ac3b6c704ec6",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "d3248bd1-20d9-45ae-9f7d-ac3b6c704ec6",
      vendorName: "Martha"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-23T03:40:51.092Z",
    reason: null
  },
  {
    id: "99dc42b8-c3e9-412e-af5c-d33e161a9e83",
    tableName: "vendor_varieties",
    recordId: "ad9705bd-a27a-4d82-b160-c490b6ff6e9f",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "d3248bd1-20d9-45ae-9f7d-ac3b6c704ec6",
      varietyId: "42230ead-5cd8-400a-9f76-1ac3f46c092d",
      vendorName: "Martha",
      varietyName: "Misc."
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-23T03:42:11.360Z",
    reason: "Vendor-variety link created via API"
  },
  {
    id: "fbbbc50f-3108-47e9-bc5b-33ab450ccc40",
    tableName: "vendors",
    recordId: "eb914651-ccc1-4523-a694-56417da75adb",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "eb914651-ccc1-4523-a694-56417da75adb",
      vendorName: "Safe Cider"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-23T19:32:12.327Z",
    reason: null
  },
  {
    id: "ccd668b7-da87-4ec4-be95-96f0427d4f07",
    tableName: "vendors",
    recordId: "88030c4f-658c-4411-b7c2-804970eefd57",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "88030c4f-658c-4411-b7c2-804970eefd57",
      vendorName: "Cane Sugar Vendor(replace)"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-23T22:15:21.951Z",
    reason: null
  },
  {
    id: "52ee4a4e-1687-489c-8de6-f197dbede04b",
    tableName: "vendors",
    recordId: "fda97909-3ebb-4125-b4e7-9727876ca34f",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "fda97909-3ebb-4125-b4e7-9727876ca34f",
      vendorName: "FruitSmart"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-23T22:45:07.173Z",
    reason: null
  },
  {
    id: "c3965606-1175-4afe-8a2f-84b0668b44fb",
    tableName: "vendors",
    recordId: "88030c4f-658c-4411-b7c2-804970eefd57",
    operation: "update",
    oldData: {
      id: "88030c4f-658c-4411-b7c2-804970eefd57",
      name: "Cane Sugar Vendor(replace)",
      isActive: true,
      createdAt: "2025-09-23T22:15:21.051Z",
      deletedAt: null,
      updatedAt: "2025-09-23T22:15:21.051Z",
      contactInfo: null
    },
    newData: {
      name: "Costco",
      contactInfo: {}
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-23T23:22:47.498Z",
    reason: null
  },
  {
    id: "b6e4eba0-07e1-4e07-a1fd-20ac25b70bfc",
    tableName: "basefruit_purchase_items",
    recordId: "e7351ae0-2a25-4589-9858-71e536189817",
    operation: "delete",
    oldData: null,
    newData: {
      deletedAt: "2025-09-23T23:31:21.258Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-23T23:31:21.516Z",
    reason: null
  },
  {
    id: "9bd617fa-528a-4153-909b-9253ffb535d2",
    tableName: "vendors",
    recordId: "5fc2f286-1698-42ce-81e3-865fbde58681",
    operation: "create",
    oldData: null,
    newData: {
      vendorId: "5fc2f286-1698-42ce-81e3-865fbde58681",
      vendorName: "Innovative Sourcing Inc."
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-23T23:52:20.574Z",
    reason: null
  },
  {
    id: "7eaf4488-84d4-4a14-ae2d-44f0fd2d0218",
    tableName: "basefruit_purchase_items",
    recordId: "57763da5-973a-48b8-b66b-7af98e4344fa",
    operation: "delete",
    oldData: null,
    newData: {
      deletedAt: "2025-09-24T02:05:27.438Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-24T02:05:27.657Z",
    reason: null
  },
  {
    id: "3d4d2f47-fb57-4b3d-96fd-943b801b91b6",
    tableName: "basefruit_purchase_items",
    recordId: "00538932-a27e-47bf-8c92-b2da98dbde79",
    operation: "delete",
    oldData: null,
    newData: {
      deletedAt: "2025-09-24T02:05:30.478Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-24T02:05:30.676Z",
    reason: null
  },
  {
    id: "3545f406-547b-44da-b83e-334fc9671180",
    tableName: "basefruit_purchase_items",
    recordId: "05c94686-8357-4b24-a52a-bdc49cd78650",
    operation: "delete",
    oldData: null,
    newData: {
      deletedAt: "2025-09-24T02:05:33.539Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-24T02:05:33.742Z",
    reason: null
  },
  {
    id: "4ef4346f-da81-4ab6-a447-5c397272f0db",
    tableName: "basefruit_purchase_items",
    recordId: "0507201f-3411-4841-b2d7-684cf1b9da7b",
    operation: "delete",
    oldData: null,
    newData: {
      deletedAt: "2025-09-24T02:05:36.981Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-24T02:05:37.172Z",
    reason: null
  },
  {
    id: "48015f71-1873-400c-af74-cdbd9d416344",
    tableName: "basefruit_purchase_items",
    recordId: "d21bbca8-d890-4aef-934f-fc127e568c10",
    operation: "delete",
    oldData: null,
    newData: {
      deletedAt: "2025-09-24T02:05:43.531Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-24T02:05:43.716Z",
    reason: null
  },
  {
    id: "6a6320ed-cdb0-4fc0-9780-5da502233485",
    tableName: "juice_purchase_items",
    recordId: "0a0d269a-87f3-403e-b8da-56449b5978ed",
    operation: "delete",
    oldData: null,
    newData: {
      deletedAt: "2025-09-24T19:19:14.651Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-24T19:19:14.840Z",
    reason: null
  },
  {
    id: "5f50a169-05a1-46af-b022-b4f56b38f87a",
    tableName: "additive_purchase_items",
    recordId: "d13f8761-241d-482d-8af7-5b7b98e9a926",
    operation: "delete",
    oldData: null,
    newData: {
      deletedAt: "2025-09-24T19:19:42.507Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-24T19:19:42.677Z",
    reason: null
  },
  {
    id: "1999a81c-29ac-42db-b794-f56065e82f53",
    tableName: "juice_purchase_items",
    recordId: "94326104-5478-4437-bd08-83b8573c1713",
    operation: "delete",
    oldData: null,
    newData: {
      deletedAt: "2025-09-27T15:47:58.739Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-27T15:47:58.996Z",
    reason: null
  },
  {
    id: "539dbc1c-60a2-4741-9211-acff74251e8c",
    tableName: "juice_purchase_items",
    recordId: "26441dbe-7aa9-4932-9960-2cded0320fdf",
    operation: "delete",
    oldData: null,
    newData: {
      deletedAt: "2025-09-27T15:48:06.303Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-27T15:48:06.527Z",
    reason: null
  },
  {
    id: "7c2b213c-f19a-4846-92e9-b2f5fdb7caa8",
    tableName: "juice_purchase_items",
    recordId: "780beafd-cfc7-4059-a6bd-b98f0b02293e",
    operation: "delete",
    oldData: null,
    newData: {
      deletedAt: "2025-09-27T16:09:24.231Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-27T16:09:24.512Z",
    reason: null
  },
  {
    id: "2af13dd3-55dd-45ca-bbfa-dbeda079aa61",
    tableName: "juice_purchase_items",
    recordId: "00237361-799c-4a68-95e6-be4bd87ba681",
    operation: "delete",
    oldData: null,
    newData: {
      deletedAt: "2025-09-27T16:15:38.310Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-27T16:15:38.497Z",
    reason: null
  },
  {
    id: "20449723-92b5-464c-923c-e98cd5f4392d",
    tableName: "juice_purchase_items",
    recordId: "0308d98f-f54d-4bdb-ac2b-1049194907f8",
    operation: "delete",
    oldData: null,
    newData: {
      deletedAt: "2025-09-27T16:25:43.927Z"
    },
    changedBy: "c77b8959-cdc1-4d33-85ad-7ae3f2b91167",
    changedAt: "2025-09-27T16:25:44.724Z",
    reason: null
  }
] as const;

export default auditLogData;
