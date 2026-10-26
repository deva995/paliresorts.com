import { Router, Request, Response, NextFunction } from 'express';
import { getEnv } from './env.js';

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Pali Resort & Club Operations Platform API',
    version: '1.0.0',
    description:
      'Backend REST API for dining, kitchen KDS, waiter floor operations, cashiering, and hotel operations.'
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1'
    }
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Liveness probe',
        description: 'Verifies the HTTP process is running.',
        responses: {
          '200': {
            description: 'Process is alive',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'pass' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/health/ready': {
      get: {
        summary: 'Readiness probe',
        description: 'Verifies database pool connection readiness.',
        responses: {
          '200': {
            description: 'Service is ready to handle traffic',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'pass' }
                  }
                }
              }
            }
          },
          '503': {
            description: 'Service unavailable / database connection failed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'fail' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/outlets/{outletId}/menu': {
      get: {
        summary: 'Effective Outlet Menu',
        description:
          'Retrieves the sanitized effective menu catalog for a specific outlet with resolved localized pricing (COALESCE(price_override_paise, base_price_paise)). Requires menu:view and outlet authorization.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'outletId',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'rest-1' }
          }
        ],
        responses: {
          '200': {
            description: 'Effective outlet menu',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    outletId: { type: 'string' },
                    categories: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          name: { type: 'string' },
                          code: { type: 'string' },
                          displayOrder: { type: 'integer' },
                          items: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                itemId: { type: 'string', format: 'uuid' },
                                name: { type: 'string' },
                                description: { type: 'string', nullable: true },
                                effectivePricePaise: {
                                  type: 'integer',
                                  description: 'Resolved price in integer paise (1 INR = 100 paise)',
                                  example: 38000
                                },
                                gstRatePercent: { type: 'number', example: 5.0 },
                                isVegetarian: { type: 'boolean' },
                                isVegan: { type: 'boolean' },
                                isSpicy: { type: 'boolean' },
                                preparationTimeMinutes: { type: 'integer' },
                                imageUrl: { type: 'string', nullable: true },
                                isAvailable: { type: 'boolean' },
                                kitchenStationCode: { type: 'string' },
                                displayOrder: { type: 'integer' }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { description: 'Authentication required' },
          '403': { description: 'Forbidden / Outlet access not granted' },
          '404': { description: 'Outlet not found' }
        }
      }
    },
    '/menu/categories': {
      get: {
        summary: 'Active Menu Categories',
        description: 'Retrieves all active master menu categories ordered by display order.',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'List of active menu categories',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    categories: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          propertyId: { type: 'string', format: 'uuid' },
                          name: { type: 'string' },
                          code: { type: 'string' },
                          displayOrder: { type: 'integer' },
                          isActive: { type: 'boolean' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/menu/items/{itemId}': {
      get: {
        summary: 'Master Menu Item Detail',
        description: 'Retrieves master catalog item detail with all outlet allocations and overrides.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'itemId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'Menu item details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    basePricePaise: {
                      type: 'integer',
                      description: 'Master catalog price in integer paise (1 INR = 100 paise)',
                      example: 38000
                    },
                    gstRatePercent: { type: 'number' },
                    outletAllocations: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          outletId: { type: 'string' },
                          priceOverridePaise: { type: 'integer', nullable: true },
                          effectivePricePaise: { type: 'integer' },
                          isAvailable: { type: 'boolean' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '404': { description: 'Menu item not found' }
        }
      }
    },
    '/menu/revisions': {
      get: {
        summary: 'List Menu Revisions',
        description: 'Queries menu item revisions in maker-checker queue.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] } },
          { name: 'menuItemId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'outletId', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } }
        ],
        responses: {
          '200': { description: 'Paginated list of revisions' }
        }
      },
      post: {
        summary: 'Submit Menu Revision Proposal',
        description:
          'Proposes a price or catalog change for maker-checker review. Does NOT directly modify live items. Requires menu:edit.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: false,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['menuItemId', 'changeSummary', 'proposedData'],
                properties: {
                  menuItemId: { type: 'string', format: 'uuid' },
                  outletId: { type: 'string', nullable: true },
                  changeSummary: { type: 'string', minLength: 3 },
                  effectiveFrom: { type: 'string', format: 'date-time', nullable: true },
                  proposedData: {
                    type: 'object',
                    properties: {
                      basePricePaise: { type: 'integer', minimum: 0 },
                      priceOverridePaise: { type: 'integer', minimum: 0, nullable: true },
                      isAvailable: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Revision proposal created in PENDING status' },
          '400': { description: 'Validation failed' }
        }
      }
    },
    '/menu/revisions/{revisionId}': {
      get: {
        summary: 'Get Menu Revision Detail',
        description: 'Retrieves proposal and approval audit details for a revision.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'revisionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
        ],
        responses: {
          '200': { description: 'Revision details with approvals' },
          '404': { description: 'Revision not found' }
        }
      }
    },
    '/menu/revisions/{revisionId}/approve': {
      post: {
        summary: 'Approve Menu Revision',
        description:
          'Applies approved changes to live catalog, logs approval, writes audit and outlet events atomically. Enforces maker-checker: submitter cannot approve own revision (422). Requires menu:approve_revisions.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'revisionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } }
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  reviewNotes: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Revision successfully approved and catalog updated' },
          '409': { description: 'Revision already approved or rejected' },
          '422': { description: 'Maker-checker violation (submitter cannot approve own revision)' }
        }
      }
    },
    '/menu/revisions/{revisionId}/reject': {
      post: {
        summary: 'Reject Menu Revision',
        description:
          'Rejects a pending revision proposal without modifying live catalog. Requires menu:approve_revisions.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'revisionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } }
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  reviewNotes: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Revision rejected' },
          '409': { description: 'Revision already processed' },
          '422': { description: 'Maker-checker violation' }
        }
      }
    },
    '/outlets/{outletId}/tables': {
      get: {
        summary: 'Outlet Floor Tables',
        description: 'Returns safe real-time floor tables for an outlet. Requires table:view and outlet access.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'outletId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Floor tables list' },
          '403': { description: 'Unauthorized outlet access' }
        }
      }
    },
    '/tables/{tableId}': {
      get: {
        summary: 'Table Details & Active Session',
        description: 'Returns detailed table state including active session summary. Requires table:view.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'tableId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Table details' },
          '404': { description: 'Table not found' }
        }
      }
    },
    '/dining-sessions': {
      post: {
        summary: 'Open Dining Session',
        description: 'Opens a new physical dining session at a table in a single atomic transaction. Requires table:assign/manage.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['outletId', 'tableId', 'guestCount'],
                properties: {
                  outletId: { type: 'string' },
                  tableId: { type: 'string', format: 'uuid' },
                  guestCount: { type: 'integer', minimum: 1 },
                  customer: {
                    type: 'object',
                    properties: {
                      phone: { type: 'string' },
                      name: { type: 'string' },
                      email: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Dining session created' },
          '409': { description: 'Table already occupied' }
        }
      }
    },
    '/dining-sessions/{sessionId}': {
      get: {
        summary: 'Dining Session Details',
        description: 'Retrieves dining session with customer info and active service requests. Requires table:view.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Dining session details' },
          '404': { description: 'Session not found' }
        }
      }
    },
    '/dining-sessions/{sessionId}/close': {
      post: {
        summary: 'Close Dining Session',
        description: 'Closes an active session once all bills are settled. Resets table to CLEANING, revokes guest tokens.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'sessionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Session closed and table reset to CLEANING' },
          '409': { description: 'Outstanding unsettled bills exist' }
        }
      }
    },
    '/dining-sessions/{sessionId}/cancel': {
      post: {
        summary: 'Cancel Dining Session',
        description: 'Cancels session prior to service/billing commencement. Resets table to AVAILABLE.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'sessionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Session cancelled' },
          '409': { description: 'Session already billed or closed' }
        }
      }
    },
    '/outlets/{outletId}/dining-sessions': {
      get: {
        summary: 'List Outlet Dining Sessions',
        description: 'Lists dining sessions for an outlet with optional status filter. Requires table:view.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'outletId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['ACTIVE', 'BILLED', 'CLOSED', 'CANCELLED'] } }
        ],
        responses: {
          '200': { description: 'List of sessions' }
        }
      }
    },
    '/service-requests/{requestId}/acknowledge': {
      post: {
        summary: 'Acknowledge Service Request',
        description: 'Staff acknowledges a pending call-bell request. Requires table:assign/view.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'requestId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Service request acknowledged' }
        }
      }
    },
    '/service-requests/{requestId}/resolve': {
      post: {
        summary: 'Resolve Service Request',
        description: 'Staff marks a service request resolved. Requires table:assign/view.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'requestId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Service request resolved' }
        }
      }
    },
    '/guest/table/resolve': {
      post: {
        summary: 'Guest QR Standee Resolve',
        description: 'Resolves physical table from scanned acrylic standee QR public code without leaking secrets.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['qrPublicCode'],
                properties: {
                  qrPublicCode: { type: 'string' },
                  qrSecretToken: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Table details for guest onboarding' },
          '401': { description: 'Invalid QR secret token proof' },
          '404': { description: 'Table not found' }
        }
      }
    },
    '/guest/otp/request': {
      post: {
        summary: 'Guest OTP Request',
        description: 'Requests 6-digit OTP for phone verification to start a guest session at an active table.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['qrPublicCode', 'phone'],
                properties: {
                  qrPublicCode: { type: 'string' },
                  phone: { type: 'string' },
                  name: { type: 'string' },
                  qrSecretToken: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'OTP sent successfully' },
          '409': { description: 'Table has no active dining session' }
        }
      }
    },
    '/guest/otp/verify': {
      post: {
        summary: 'Guest OTP Verify',
        description: 'Verifies 6-digit OTP and returns guest bearer token.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['sessionTokenId', 'otp'],
                properties: {
                  sessionTokenId: { type: 'string', format: 'uuid' },
                  otp: { type: 'string', pattern: '^\\d{6}$' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Guest bearer token issued' },
          '400': { description: 'Invalid or expired OTP' }
        }
      }
    },
    '/guest/session': {
      get: {
        summary: 'Guest Active Session Summary',
        description: 'Retrieves current active dining session for the authenticated guest device.',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Guest session summary' },
          '401': { description: 'Invalid or expired guest token' }
        }
      }
    },
    '/guest/service-requests': {
      post: {
        summary: 'Create Guest Service Request',
        description: 'Guest creates a call-bell service request (e.g. CALL_WAITER, WATER, BILL).',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['requestType'],
                properties: {
                  requestType: { type: 'string', enum: ['CALL_WAITER', 'WATER', 'BILL', 'CUTLERY', 'CLEANING'] }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Service request created' }
        }
      }
    },
    '/orders': {
      post: {
        summary: 'Place Staff Order Round',
        description: 'Steward/waiter punches a new order round for a dining table session. Prices and GST snapshots are resolved server-side.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['outletId', 'diningSessionId', 'items'],
                properties: {
                  outletId: { type: 'string' },
                  diningSessionId: { type: 'string', format: 'uuid' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['menuItemId', 'quantity'],
                      properties: {
                        menuItemId: { type: 'string', format: 'uuid' },
                        quantity: { type: 'integer', minimum: 1 },
                        customizationNotes: { type: 'string' }
                      }
                    }
                  },
                  specialInstructions: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Order created with server-computed prices and round number' },
          '400': { description: 'Outlet mismatch or validation failure' },
          '409': { description: 'Session billed/closed or round conflict' },
          '422': { description: 'Item inactive, unavailable, or 86ed' }
        }
      }
    },
    '/orders/{orderId}': {
      get: {
        summary: 'Get Order Details',
        description: 'Retrieves full details of an order including line items, prices, and status. Requires order:view.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Order details' },
          '404': { description: 'Order not found' }
        }
      }
    },
    '/outlets/{outletId}/orders': {
      get: {
        summary: 'List Outlet Orders',
        description: 'Lists all orders for an outlet with optional status filtering. Requires order:view.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'outletId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'] } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', required: false, schema: { type: 'integer', default: 0 } }
        ],
        responses: {
          '200': { description: 'List of orders' }
        }
      }
    },
    '/dining-sessions/{sessionId}/orders': {
      get: {
        summary: 'List Dining Session Orders',
        description: 'Lists all order rounds placed for a specific dining session. Requires order:view.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'List of orders for dining session' }
        }
      }
    },
    '/orders/{orderId}/status': {
      post: {
        summary: 'Update Order Status',
        description: 'Advances order lifecycle status (PLACED -> ACCEPTED -> PREPARING -> READY -> SERVED). Requires order:update.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['ACCEPTED', 'PREPARING', 'READY', 'SERVED'] },
                  notes: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Order status updated' },
          '409': { description: 'Invalid status progression transition' }
        }
      }
    },
    '/orders/{orderId}/cancel': {
      post: {
        summary: 'Cancel Order',
        description: 'Cancels order and unserved items. Requires order:cancel. Orders cannot be cancelled once served or billed.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  reason: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Order cancelled' },
          '409': { description: 'Order already served, cancelled, or attached to active bill' }
        }
      }
    },
    '/guest/orders': {
      post: {
        summary: 'Place Guest Order Round',
        description: 'Guest submits an order round from mobile QR web app. Session, outlet, and table are strictly derived from guest session context.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items'],
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['menuItemId', 'quantity'],
                      properties: {
                        menuItemId: { type: 'string', format: 'uuid' },
                        quantity: { type: 'integer', minimum: 1 },
                        customizationNotes: { type: 'string' }
                      }
                    }
                  },
                  specialInstructions: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Guest order round placed' },
          '409': { description: 'Dining session is closed or billed' },
          '422': { description: 'Item unavailable or 86ed' }
        }
      },
      get: {
        summary: 'List Guest Orders',
        description: 'Lists all orders placed for the authenticated guest session.',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'List of guest orders' }
        }
      }
    },
    '/guest/orders/{orderId}': {
      get: {
        summary: 'Get Guest Order Details',
        description: 'Retrieves order details for the authenticated guest session, ensuring tenant isolation.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Order details' },
          '404': { description: 'Order not found or belongs to another session' }
        }
      }
    },
    '/outlets/{outletId}/kitchen/stations': {
      get: {
        summary: 'List Kitchen Stations',
        description: 'Lists physical food and beverage preparation stations configured for an outlet.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'outletId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'List of kitchen stations' },
          '403': { description: 'Forbidden - staff lacks outlet access' }
        }
      }
    },
    '/outlets/{outletId}/kots': {
      get: {
        summary: 'KDS Ticket Queue',
        description: 'Lists KOT tickets for an outlet with optional filtering by station, status, or active queue. Requires kds:view.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'outletId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'stationId', in: 'query', required: false, schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'] } },
          { name: 'activeOnly', in: 'query', required: false, schema: { type: 'boolean' } },
          { name: 'orderId', in: 'query', required: false, schema: { type: 'string', format: 'uuid' } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', required: false, schema: { type: 'integer', default: 0 } }
        ],
        responses: {
          '200': { description: 'KDS ticket queue' },
          '403': { description: 'Forbidden - staff lacks kds:view or outlet access' }
        }
      }
    },
    '/kots/{kotId}': {
      get: {
        summary: 'Get KOT Details',
        description: 'Retrieves complete KOT preparation ticket details and item progress. Requires kds:view.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'kotId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'KOT details' },
          '404': { description: 'KOT not found' }
        }
      }
    },
    '/orders/{orderId}/kots': {
      post: {
        summary: 'Generate Order KOTs (Fire to Kitchen)',
        description: 'Fires an order to physical kitchen preparation stations. Splits multi-station items, allocates daily KOT numbers, and sets order status to ACCEPTED.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'orderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } }
        ],
        responses: {
          '201': { description: 'KOTs generated and dispatched to stations' },
          '400': { description: 'Invalid order state or cross-outlet mismatch' },
          '409': { description: 'Order already cancelled, ready, or served' },
          '422': { description: 'Item has no valid station mapping or inactive station' }
        }
      }
    },
    '/kots/{kotId}/accept': {
      post: {
        summary: 'Acknowledge / Accept KOT',
        description: 'Kitchen station accepts an incoming ticket. Requires kds:update.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'kotId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'KOT accepted' },
          '409': { description: 'Invalid state transition' }
        }
      }
    },
    '/kots/{kotId}/start': {
      post: {
        summary: 'Start KOT Preparation',
        description: 'Station begins preparing items. Sets preparing_at and advances order to PREPARING. Requires kds:update.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'kotId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'KOT preparing' },
          '409': { description: 'Invalid state transition' }
        }
      }
    },
    '/kots/{kotId}/ready': {
      post: {
        summary: 'Mark KOT Ready at Pass',
        description: 'Marks ticket ready for steward pickup. Synchronizes order status if all station KOTs are ready. Requires kds:update.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'kotId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'KOT ready at pass' },
          '409': { description: 'Invalid state transition' }
        }
      }
    },
    '/kots/{kotId}/served': {
      post: {
        summary: 'Mark KOT Served to Guest',
        description: 'Confirms delivery to guest table or room. Synchronizes order status when all KOTs served. Requires kds:update.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'kotId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'KOT served' },
          '409': { description: 'Invalid state transition' }
        }
      }
    },
    '/kots/{kotId}/cancel': {
      post: {
        summary: 'Cancel KOT',
        description: 'Cancels unserved KOT ticket and its lines. Requires order:cancel or kds:update.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'kotId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  reason: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'KOT cancelled' },
          '409': { description: 'KOT already served or cancelled' }
        }
      }
    },
    '/kot-items/{kotItemId}/status': {
      post: {
        summary: 'Update KOT Item Status',
        description: 'Item-level kitchen status progression (NEW -> PREPARING -> READY -> SERVED). Recomputes parent KOT status deterministically. Requires kds:update.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'kotItemId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['PREPARING', 'READY', 'SERVED', 'CANCELLED'] }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Item status updated and parent KOT synchronized' },
          '409': { description: 'Invalid item state transition' }
        }
      }
    },
    '/dining-sessions/{sessionId}/bill-preview': {
      get: {
        summary: 'Preview Session Bill (Ephemeral)',
        description: 'Calculates an ephemeral pre-tax, tax, and total billing breakdown for an active dining session without persisting to database. Requires bill:view.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Ephemeral bill preview with line items and GST calculation' },
          '404': { description: 'Dining session not found' },
          '422': { description: 'No billable orders found for dining session' }
        }
      }
    },
    '/dining-sessions/{sessionId}/bills': {
      post: {
        summary: 'Generate Dining Session Bill (Fiscal Invoice)',
        description: 'Generates and commits an authoritative fiscal invoice/bill for a dining session. Allocates sequential invoice number from outlet_counters, captures immutable snapshots in bill_items, and transitions dining session to BILLED. Requires bill:generate.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'sessionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  notes: { type: 'string', maxLength: 500 }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Fiscal invoice/bill generated successfully' },
          '403': { description: 'Forbidden - staff lacks bill:generate or outlet access' },
          '404': { description: 'Dining session not found' },
          '409': { description: 'Conflict - active bill already exists or session is closed/cancelled' },
          '422': { description: 'Unprocessable - no billable orders for session' }
        }
      },
      get: {
        summary: 'List Dining Session Bills',
        description: 'Lists all bills generated for a dining session (including draft, approved, and settled). Requires bill:view.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'List of bills for dining session' },
          '403': { description: 'Forbidden - staff lacks bill:view or outlet access' }
        }
      }
    },
    '/bills/{billId}': {
      get: {
        summary: 'Get Bill Details',
        description: 'Retrieves complete fiscal invoice details and immutable line item breakdown. Requires bill:view.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'billId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Bill details with item snapshots' },
          '403': { description: 'Forbidden - staff lacks bill:view or outlet access' },
          '404': { description: 'Bill not found' }
        }
      }
    },
    '/bills/{billId}/finalize': {
      post: {
        summary: 'Finalize / Approve Bill',
        description: 'Freezes an interim draft bill and marks it APPROVED. Requires bill:generate or bill:settle.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'billId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  notes: { type: 'string', maxLength: 500 }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Bill finalized and approved' },
          '403': { description: 'Forbidden - staff lacks permission or outlet access' },
          '404': { description: 'Bill not found' },
          '409': { description: 'Conflict - bill is not in DRAFT status' }
        }
      }
    },
    '/bills/{billId}/discount': {
      post: {
        summary: 'Apply Approved Discount to Bill',
        description: 'Applies an approved discount from Domain I (approval_requests) to an active bill. Validates maker-checker authorization and recomputes tax and grand total. Requires bill:apply_discount.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'billId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['approvalRequestId'],
                properties: {
                  approvalRequestId: { type: 'string', format: 'uuid' },
                  notes: { type: 'string', maxLength: 500 }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Discount applied and bill recomputed' },
          '400': { description: 'Bad Request - cross-outlet request or discount exceeds subtotal' },
          '403': { description: 'Forbidden - staff lacks permission or maker-checker violation' },
          '404': { description: 'Bill or approval request not found' },
          '409': { description: 'Conflict - bill is settled or voided' },
          '422': { description: 'Unprocessable - request is not APPROVED or not DISCOUNT/COMP' }
        }
      }
    },
    '/bills/{billId}/payments': {
      post: {
        summary: 'Record Payment Tender Against Bill',
        description: 'Records a payment transaction against a bill. Supports CASH, UPI, CARD, and ROOM_FOLIO. Validates overpayment, handles split tenders, and marks bill SETTLED when balance reaches zero. Requires payment:process or bill:settle.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'billId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['paymentMethod', 'amountPaise'],
                properties: {
                  paymentMethod: { type: 'string', enum: ['CASH', 'UPI', 'CARD', 'ROOM_FOLIO'] },
                  amountPaise: { type: 'integer', minimum: 1 },
                  transactionReference: { type: 'string', maxLength: 150 },
                  razorpayOrderId: { type: 'string', maxLength: 100 },
                  razorpayPaymentId: { type: 'string', maxLength: 100 },
                  razorpaySignature: { type: 'string', maxLength: 255 },
                  hotelStayId: { type: 'string', format: 'uuid' },
                  roomId: { type: 'string', format: 'uuid' },
                  notes: { type: 'string', maxLength: 500 }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Payment recorded and allocated successfully' },
          '400': { description: 'Bad Request - overpayment on electronic tender or invalid Razorpay signature' },
          '403': { description: 'Forbidden - staff lacks permission or outlet access' },
          '404': { description: 'Bill not found' },
          '409': { description: 'Conflict - bill is already settled or voided' }
        }
      },
      get: {
        summary: 'List Payments for Bill',
        description: 'Lists all payments and split-tender allocations recorded against a bill. Requires bill:view or payment:process.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'billId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
        ],
        responses: {
          '200': { description: 'List of payments and allocations for the bill' },
          '403': { description: 'Forbidden - staff lacks permission or outlet access' },
          '404': { description: 'Bill not found' }
        }
      }
    },
    '/payments/{paymentId}': {
      get: {
        summary: 'Get Payment Details',
        description: 'Retrieves complete details for a payment and its bill allocations. Requires bill:view or payment:process.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'paymentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
        ],
        responses: {
          '200': { description: 'Payment details and allocations' },
          '403': { description: 'Forbidden - staff lacks permission or outlet access' },
          '404': { description: 'Payment not found' }
        }
      }
    },
    '/payments/{paymentId}/refunds': {
      post: {
        summary: 'Process Financial Refund',
        description: 'Processes a partial or full financial refund against a captured payment. Updates payment status to PARTIALLY_REFUNDED or REFUNDED, and re-opens bill balance. Requires payment:refund.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'paymentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['amountPaise', 'reason'],
                properties: {
                  amountPaise: { type: 'integer', minimum: 1 },
                  reason: { type: 'string', minLength: 1, maxLength: 500 },
                  gatewayRefundId: { type: 'string', maxLength: 100 }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Refund processed successfully' },
          '400': { description: 'Bad Request - cumulative refund exceeds payment amount' },
          '403': { description: 'Forbidden - staff lacks payment:refund or outlet access' },
          '404': { description: 'Payment not found' },
          '409': { description: 'Conflict - payment is not in CAPTURED or PARTIALLY_REFUNDED status' }
        }
      },
      get: {
        summary: 'List Payment Refunds',
        description: 'Lists all refund transactions issued against a captured payment. Requires bill:view or payment:refund.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'paymentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
        ],
        responses: {
          '200': { description: 'List of refunds for the payment' },
          '403': { description: 'Forbidden - staff lacks permission or outlet access' },
          '404': { description: 'Payment not found' }
        }
      }
    },
    '/outlets/{outletId}/bills': {
      get: {
        summary: 'List Outlet Bills',
        description: 'Lists all bills generated for an outlet with optional status filtering and pagination. Requires bill:view.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'outletId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SETTLED', 'VOIDED'] } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', required: false, schema: { type: 'integer', default: 0 } }
        ],
        responses: {
          '200': { description: 'Paginated list of outlet bills' },
          '403': { description: 'Forbidden - staff lacks outlet access' }
        }
      }
    },
    '/guest/bill': {
      get: {
        summary: 'Get Guest Session Bill',
        description: 'Retrieves the active invoice/bill for the authenticated guest dining session. Isolated strictly to the guest token context.',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Active bill for guest dining session' },
          '401': { description: 'Unauthorized - invalid or expired guest token' },
          '404': { description: 'No active bill generated yet for session' }
        }
      }
    },
    '/inventory/items': {
      get: {
        summary: 'List Inventory Items',
        description: 'Lists master inventory catalog items with optional filtering by category, active status, below reorder level, and search. Requires inventory:view, inventory:manage, or menu:view.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'category', in: 'query', required: false, schema: { type: 'string', enum: ['FOOD_GRAINS', 'DAIRY', 'MEAT', 'LIQUOR', 'BEVERAGES', 'CLEANING', 'LINEN', 'OTHER'] } },
          { name: 'isActive', in: 'query', required: false, schema: { type: 'boolean' } },
          { name: 'belowReorderLevel', in: 'query', required: false, schema: { type: 'boolean' } },
          { name: 'search', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', required: false, schema: { type: 'integer', default: 0 } }
        ],
        responses: {
          '200': { description: 'Paginated list of inventory items' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' }
        }
      },
      post: {
        summary: 'Create Inventory Item',
        description: 'Creates a new inventory master item SKU. Requires inventory:manage.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['itemCode', 'name', 'category', 'unitOfMeasure'],
                properties: {
                  itemCode: { type: 'string', example: 'ING-DAIRY-001' },
                  name: { type: 'string', example: 'Amul Malai Paneer' },
                  category: { type: 'string', enum: ['FOOD_GRAINS', 'DAIRY', 'MEAT', 'LIQUOR', 'BEVERAGES', 'CLEANING', 'LINEN', 'OTHER'] },
                  unitOfMeasure: { type: 'string', example: 'KG' },
                  reorderLevel: { type: 'number', example: 10.0 },
                  unitCostPaise: { type: 'integer', example: 38000 },
                  isActive: { type: 'boolean', default: true }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Inventory item created' },
          '400': { description: 'Bad request or malformed quantity' },
          '403': { description: 'Forbidden - lacks inventory:manage' },
          '409': { description: 'Conflict - duplicate itemCode' }
        }
      }
    },
    '/inventory/items/{itemId}': {
      get: {
        summary: 'Get Inventory Item',
        description: 'Retrieves inventory master item details by UUID. Requires inventory:view, inventory:manage, or menu:view.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Inventory item details' },
          '404': { description: 'Item not found' }
        }
      },
      patch: {
        summary: 'Update Inventory Item',
        description: 'Updates inventory master item details. Requires inventory:manage.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  itemCode: { type: 'string' },
                  name: { type: 'string' },
                  category: { type: 'string' },
                  unitOfMeasure: { type: 'string' },
                  reorderLevel: { type: 'number' },
                  unitCostPaise: { type: 'integer' },
                  isActive: { type: 'boolean' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Updated inventory item' },
          '404': { description: 'Item not found' },
          '409': { description: 'Conflict - itemCode already exists' }
        }
      }
    },
    '/inventory/locations': {
      get: {
        summary: 'List Inventory Locations',
        description: 'Lists physical storerooms, warehouses, cellars, and outlet pantries. Requires inventory:view or inventory:manage.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'outletId', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'isCentral', in: 'query', required: false, schema: { type: 'boolean' } },
          { name: 'isActive', in: 'query', required: false, schema: { type: 'boolean' } }
        ],
        responses: {
          '200': { description: 'List of inventory locations' }
        }
      }
    },
    '/inventory/locations/{locationId}': {
      get: {
        summary: 'Get Inventory Location',
        description: 'Retrieves an inventory location by UUID. Requires inventory:view or inventory:manage.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'locationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Inventory location details' },
          '404': { description: 'Location not found' }
        }
      }
    },
    '/inventory/balances': {
      get: {
        summary: 'List Inventory Balances',
        description: 'Lists on-hand stock quantities per item and location with optional filters. Requires inventory:view or inventory:manage.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'locationId', in: 'query', required: false, schema: { type: 'string', format: 'uuid' } },
          { name: 'outletId', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'itemId', in: 'query', required: false, schema: { type: 'string', format: 'uuid' } },
          { name: 'category', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'belowReorderLevel', in: 'query', required: false, schema: { type: 'boolean' } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', required: false, schema: { type: 'integer', default: 0 } }
        ],
        responses: {
          '200': { description: 'Paginated inventory balances' }
        }
      }
    },
    '/inventory/items/{itemId}/balances': {
      get: {
        summary: 'Get Item Balances Across Locations',
        description: 'Retrieves on-hand stock balances across all locations for a specific item. Requires inventory:view or inventory:manage.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'List of location balances for item' }
        }
      }
    },
    '/inventory/movements': {
      post: {
        summary: 'Record Stock Movement',
        description: 'Records an append-only stock movement (PURCHASE, CONSUMPTION, ADJUSTMENT, WASTAGE, RETURN) and atomically updates on-hand balance. Requires inventory:manage and Idempotency-Key.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['itemId', 'locationId', 'movementType', 'quantity'],
                properties: {
                  itemId: { type: 'string', format: 'uuid' },
                  locationId: { type: 'string', format: 'uuid' },
                  movementType: { type: 'string', enum: ['PURCHASE', 'CONSUMPTION', 'ADJUSTMENT', 'WASTAGE', 'RETURN', 'TRANSFER_IN', 'TRANSFER_OUT'] },
                  quantity: { type: 'number', example: 5.5 },
                  referenceDocument: { type: 'string', example: 'INV-2026-0042' },
                  notes: { type: 'string', example: 'Received fresh delivery' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Stock movement recorded and balance updated' },
          '400': { description: 'Bad request or malformed quantity' },
          '403': { description: 'Forbidden - lacks inventory:manage or outlet access' },
          '404': { description: 'Item or location not found' },
          '422': { description: 'Idempotency conflict or inactive item/location' }
        }
      }
    },
    '/inventory/transfers': {
      post: {
        summary: 'Inter-Location Stock Transfer',
        description: 'Executes an atomic stock transfer between two locations, generating correlated TRANSFER_OUT and TRANSFER_IN movements with matching transferGroupId and pairedMovementId. Requires inventory:manage and Idempotency-Key.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['itemId', 'sourceLocationId', 'destinationLocationId', 'quantity'],
                properties: {
                  itemId: { type: 'string', format: 'uuid' },
                  sourceLocationId: { type: 'string', format: 'uuid' },
                  destinationLocationId: { type: 'string', format: 'uuid' },
                  quantity: { type: 'number', example: 10.0 },
                  referenceDocument: { type: 'string', example: 'TRF-REQ-001' },
                  notes: { type: 'string', example: 'Store to restaurant pantry issue' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Stock transfer executed successfully' },
          '400': { description: 'Bad request - identical source/destination or invalid quantity' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Item or location not found' }
        }
      }
    },
    '/recipes': {
      get: {
        summary: 'List Recipes (BOM)',
        description: 'Lists Bill-of-Materials recipes for menu items. Requires menu:view, inventory:view, or inventory:manage.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'menuItemId', in: 'query', required: false, schema: { type: 'string', format: 'uuid' } },
          { name: 'search', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', required: false, schema: { type: 'integer', default: 0 } }
        ],
        responses: {
          '200': { description: 'List of recipes with ingredients' }
        }
      },
      post: {
        summary: 'Create Recipe (BOM)',
        description: 'Creates a recipe header and optional ingredient requirements for a menu item. Requires inventory:manage.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['menuItemId', 'name'],
                properties: {
                  menuItemId: { type: 'string', format: 'uuid' },
                  name: { type: 'string', example: 'Paneer Tikka Angaar Standard Recipe' },
                  yieldServings: { type: 'integer', default: 1 },
                  ingredients: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['inventoryItemId', 'quantityRequired', 'unitOfMeasure'],
                      properties: {
                        inventoryItemId: { type: 'string', format: 'uuid' },
                        quantityRequired: { type: 'number', example: 0.25 },
                        unitOfMeasure: { type: 'string', example: 'KG' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Recipe created' },
          '404': { description: 'Menu item or ingredient not found' },
          '409': { description: 'Duplicate ingredient in recipe' }
        }
      }
    },
    '/recipes/{recipeId}': {
      get: {
        summary: 'Get Recipe Details',
        description: 'Retrieves recipe header and list of required ingredients. Requires menu:view, inventory:view, or inventory:manage.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'recipeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Recipe with ingredients' },
          '404': { description: 'Recipe not found' }
        }
      },
      patch: {
        summary: 'Update Recipe Header',
        description: 'Updates recipe name or yield servings. Requires inventory:manage.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'recipeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  yieldServings: { type: 'integer' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Recipe updated' },
          '404': { description: 'Recipe not found' }
        }
      }
    },
    '/menu-items/{menuItemId}/recipe': {
      get: {
        summary: 'Get Recipe by Menu Item',
        description: 'Retrieves the active Bill-of-Materials recipe for a specific menu item. Requires menu:view, inventory:view, or inventory:manage.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'menuItemId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Recipe for menu item' },
          '404': { description: 'No recipe found for menu item' }
        }
      }
    },
    '/recipes/{recipeId}/ingredients': {
      post: {
        summary: 'Add Recipe Ingredient',
        description: 'Adds an ingredient line to a recipe BOM. Enforces composite uniqueness (recipe_id, inventory_item_id). Requires inventory:manage.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'recipeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['inventoryItemId', 'quantityRequired', 'unitOfMeasure'],
                properties: {
                  inventoryItemId: { type: 'string', format: 'uuid' },
                  quantityRequired: { type: 'number', example: 0.05 },
                  unitOfMeasure: { type: 'string', example: 'KG' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Ingredient added to recipe' },
          '404': { description: 'Recipe or inventory item not found' },
          '409': { description: 'Ingredient already exists in recipe' }
        }
      }
    },
    '/recipes/{recipeId}/ingredients/{ingredientId}': {
      patch: {
        summary: 'Update Recipe Ingredient',
        description: 'Updates required quantity or unit of measure for an ingredient line. Requires inventory:manage.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'recipeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'ingredientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  quantityRequired: { type: 'number', example: 0.1 },
                  unitOfMeasure: { type: 'string', example: 'KG' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Ingredient updated' },
          '404': { description: 'Ingredient not found' }
        }
      },
      delete: {
        summary: 'Remove Recipe Ingredient',
        description: 'Deletes an ingredient line from a recipe. Requires inventory:manage.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'recipeId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'ingredientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
        ],
        responses: {
          '204': { description: 'Ingredient removed from recipe' },
          '404': { description: 'Ingredient not found' }
        }
      }
    },
    '/hotel/rooms': {
      get: {
        summary: 'List Hotel Rooms',
        description: 'Retrieves physical hotel rooms, suites, and villas with status and floor filters.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'DIRTY', 'CLEANING', 'INSPECTED', 'MAINTENANCE', 'OUT_OF_SERVICE'] } },
          { name: 'roomType', in: 'query', schema: { type: 'string' } },
          { name: 'floor', in: 'query', schema: { type: 'integer' } },
          { name: 'isActive', in: 'query', schema: { type: 'boolean' } }
        ],
        responses: {
          '200': { description: 'List of hotel rooms' }
        }
      }
    },
    '/hotel/rooms/{roomId}': {
      get: {
        summary: 'Get Hotel Room',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'roomId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Room detail' },
          '404': { description: 'Room not found' }
        }
      }
    },
    '/hotel/check-in': {
      post: {
        summary: 'Hotel Guest Check-In',
        description: 'Executes transactional guest check-in, initializes room stay and open folio, and transitions room status to OCCUPIED.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['roomId', 'guestId', 'expectedCheckOutAt'],
                properties: {
                  roomId: { type: 'string', format: 'uuid' },
                  guestId: { type: 'string', format: 'uuid' },
                  reservationId: { type: 'string', format: 'uuid', nullable: true },
                  expectedCheckOutAt: { type: 'string', format: 'date-time' },
                  initialTariffPaise: { type: 'integer', example: 1200000 }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Guest successfully checked in' },
          '409': { description: 'Room not available or already has active stay' }
        }
      }
    },
    '/hotel/stays/{stayId}/checkout': {
      post: {
        summary: 'Hotel Guest Checkout',
        description: 'Validates folio settlement, closes stay, transitions room to DIRTY, and creates checkout cleaning task.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'stayId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Guest successfully checked out' },
          '409': { description: 'Folio has unsettled outstanding balance' }
        }
      }
    },
    '/housekeeping/tasks': {
      get: {
        summary: 'List Housekeeping Tasks',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'roomId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'INSPECTED'] } }
        ],
        responses: {
          '200': { description: 'List of housekeeping tasks' }
        }
      }
    },
    '/maintenance/issues': {
      post: {
        summary: 'Report Maintenance Issue',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['category', 'severity', 'description'],
                properties: {
                  roomId: { type: 'string', format: 'uuid', nullable: true },
                  outletId: { type: 'string', nullable: true },
                  category: { type: 'string', enum: ['PLUMBING', 'ELECTRICAL', 'HVAC', 'FURNITURE', 'OTHER'] },
                  severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
                  description: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Maintenance issue reported' }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token provided via Authorization header'
      }
    }
  }
};

/**
 * Middleware protecting documentation in production
 */
function protectDocsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const env = getEnv();

  // If docs are disabled, return 404
  if (!env.DOCS_ENABLED) {
    res.status(404).json({ error: 'Documentation is disabled on this server.' });
    return;
  }

  // If password protection is configured, enforce HTTP Basic Auth
  if (env.DOCS_PASSWORD) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Pali Resort API Docs"');
      res.status(401).send('Authentication required to access documentation');
      return;
    }

    const credentials = Buffer.from(authHeader.split(' ')[1] || '', 'base64').toString('utf-8');
    const [, password] = credentials.split(':');

    if (password !== env.DOCS_PASSWORD) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Pali Resort API Docs"');
      res.status(401).send('Invalid credentials');
      return;
    }
  }

  next();
}

export const docsRouter = Router();

// OpenAPI JSON
docsRouter.get('/openapi.json', protectDocsMiddleware, (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

// Minimal HTML UI for OpenAPI Viewer
docsRouter.get('/docs', protectDocsMiddleware, (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Pali Resort & Club - API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body style="margin: 0; background: #fafafa;">
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: '/api/v1/openapi.json',
        dom_id: '#swagger-ui'
      });
    };
  </script>
</body>
</html>`);
});
