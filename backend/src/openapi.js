export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Tails Survive API',
    version: '0.1.0',
    description: 'API калькулятора недельного события «Турбочерепашка». Тестовый пользователь: root / 0000.'
  },
  servers: [{ url: '/', description: 'Текущий backend' }],
  tags: [
    { name: 'System', description: 'Состояние сервиса и контекст события' },
    { name: 'Auth', description: 'Регистрация и вход' },
    { name: 'User', description: 'Профиль и сохраненные значения пользователя' },
    { name: 'Dictionary', description: 'Элементы и правила начисления очков' },
    { name: 'Calculator', description: 'Расчет очков' }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Проверить состояние API',
        responses: {
          200: {
            description: 'API работает',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Health' } } }
          }
        }
      }
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Зарегистрировать пользователя',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } }
        },
        responses: {
          201: { $ref: '#/components/responses/AuthSuccess' },
          400: { $ref: '#/components/responses/BadRequest' },
          409: { $ref: '#/components/responses/Conflict' }
        }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Войти в аккаунт',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthRequest' },
              example: { username: 'root', password: '0000' }
            }
          }
        },
        responses: {
          200: { $ref: '#/components/responses/AuthSuccess' },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/me': {
      get: {
        tags: ['User'],
        summary: 'Получить текущего пользователя',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Текущий пользователь',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['user'],
                  properties: { user: { $ref: '#/components/schemas/User' } }
                }
              }
            }
          },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/me/element-values': {
      get: {
        tags: ['User'],
        summary: 'Получить сохраненные значения элементов',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Значения пользователя',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/UserElementValue' } }
              }
            }
          },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      },
      put: {
        tags: ['User'],
        summary: 'Сохранить или обновить значения элементов',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UserElementValuesRequest' } } }
        },
        responses: {
          200: {
            description: 'Все сохраненные значения после обновления',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/UserElementValue' } }
              }
            }
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      },
      delete: {
        tags: ['User'],
        summary: 'Сбросить все значения пользователя',
        security: [{ bearerAuth: [] }],
        responses: {
          204: { description: 'Значения удалены' },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/me/element-values/{elementKey}': {
      delete: {
        tags: ['User'],
        summary: 'Удалить значение одного элемента',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'elementKey',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'gear-scraps'
          }
        ],
        responses: {
          204: { description: 'Значение удалено' },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/me/calculator': {
      get: {
        tags: ['User', 'Calculator'],
        summary: 'Получить сохраненное состояние калькулятора',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'План, универсальные ускорения и расчет',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CalculatorState' } } }
          },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      },
      delete: {
        tags: ['User', 'Calculator'],
        summary: 'Полностью сбросить калькулятор',
        security: [{ bearerAuth: [] }],
        responses: {
          204: { description: 'Запасы, план и распределение удалены' },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/me/plan-items': {
      put: {
        tags: ['Calculator'],
        summary: 'Сохранить строки плана',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items'],
                properties: { items: { type: 'array', items: { $ref: '#/components/schemas/PlanItemInput' } } }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Сохраненный план',
            content: {
              'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/PlanItem' } } }
            }
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/me/speedup-allocation': {
      put: {
        tags: ['Calculator'],
        summary: 'Сохранить общий запас универсальных ускорений',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UniversalSpeedupInput' } } }
        },
        responses: {
          200: {
            description: 'Общий запас и текущее распределение',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UniversalSpeedupSummary' } } }
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/me/training-plan': {
      put: {
        tags: ['Calculator'],
        summary: 'Сохранить план обучения солдат',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TrainingPlanInput' } } }
        },
        responses: {
          200: {
            description: 'Сохраненный план обучения',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TrainingPlan' } } }
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/me/calculation': {
      get: {
        tags: ['Calculator'],
        summary: 'Рассчитать сохраненный план',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Очки по строкам и дням',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UserPlanCalculation' } } }
          },
          401: { $ref: '#/components/responses/Unauthorized' }
        }
      }
    },
    '/api/event-context': {
      get: {
        tags: ['System'],
        summary: 'Получить контекст события',
        responses: {
          200: {
            description: 'Контекст и счетчики справочников',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/EventContext' } } }
          }
        }
      }
    },
    '/api/dictionaries': {
      get: {
        tags: ['Dictionary'],
        summary: 'Получить все справочники',
        responses: {
          200: {
            description: 'Элементы и правила',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['elements', 'rules'],
                  properties: {
                    elements: { type: 'array', items: { $ref: '#/components/schemas/Element' } },
                    rules: { type: 'array', items: { $ref: '#/components/schemas/EventRule' } }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/elements': {
      get: {
        tags: ['Dictionary'],
        summary: 'Получить элементы',
        responses: {
          200: {
            description: 'Справочник элементов',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Element' } }
              }
            }
          }
        }
      }
    },
    '/api/rules': {
      get: {
        tags: ['Dictionary'],
        summary: 'Получить правила начисления очков',
        description: 'Можно фильтровать либо по дню, либо по ключу элемента.',
        parameters: [
          { name: 'day', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 7 }, example: 7 },
          { name: 'elementKey', in: 'query', schema: { type: 'string' }, example: 'gear-scraps' }
        ],
        responses: {
          200: {
            description: 'Правила начисления',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/EventRule' } }
              }
            }
          }
        }
      }
    },
    '/api/calculate': {
      post: {
        tags: ['Calculator'],
        summary: 'Рассчитать очки по переданным коэффициентам',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CalculationRequest' } } }
        },
        responses: {
          200: {
            description: 'Результат расчета',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CalculationResponse' } } }
          }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'token' }
    },
    schemas: {
      Health: {
        type: 'object',
        required: ['status'],
        properties: { status: { type: 'string', example: 'ok' } }
      },
      Error: {
        type: 'object',
        required: ['error'],
        properties: { error: { type: 'string' } }
      },
      AuthRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 32, example: 'player1' },
          password: { type: 'string', format: 'password', example: 'secret123' }
        }
      },
      RegisterRequest: {
        type: 'object',
        required: ['username', 'password', 'gameNickname'],
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 32, example: 'player1' },
          password: { type: 'string', format: 'password', example: 'secret123' },
          gameNickname: { type: 'string', minLength: 1, maxLength: 32, example: 'Игрок 1' }
        }
      },
      User: {
        type: 'object',
        required: ['id', 'username', 'gameNickname', 'createdAt'],
        properties: {
          id: { type: 'integer', example: 1 },
          username: { type: 'string', example: 'root' },
          gameNickname: { type: 'string', example: 'Root' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      AuthResponse: {
        type: 'object',
        required: ['user', 'token'],
        properties: {
          user: { $ref: '#/components/schemas/User' },
          token: { type: 'string', description: 'Bearer-токен, действующий 30 дней' }
        }
      },
      Element: {
        type: 'object',
        required: ['key', 'name', 'category', 'unit', 'icon', 'days'],
        properties: {
          key: { type: 'string', example: 'gear-scraps' },
          name: { type: 'string', example: 'Обломки снаряжения' },
          category: { type: 'string', example: 'Снаряжение героя' },
          unit: { type: 'string', example: 'Опыт снаряжения' },
          icon: { type: 'string', example: '/icons/resources/gear-scraps.svg' },
          days: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 7 }, example: [1, 2, 5, 7] },
          tier: { type: ['integer', 'null'], minimum: 1, example: 1 },
          colorName: { type: ['string', 'null'], example: 'Голубой' },
          colorHex: { type: ['string', 'null'], pattern: '^#[0-9A-Fa-f]{6}$', example: '#38BDF8' }
        }
      },
      EventRule: {
        type: 'object',
        required: ['key', 'elementKey', 'action', 'points', 'days', 'sortOrder', 'calculatorVisible'],
        properties: {
          key: { type: 'string', example: 'gear-scraps-100-xp' },
          elementKey: { type: 'string', example: 'gear-scraps' },
          action: { type: 'string', example: 'Используйте обломки снаряжения (1) на 100 ед. опыта' },
          points: { type: 'integer', example: 4000 },
          days: { type: 'array', items: { type: 'integer' }, example: [1, 2, 5, 7] },
          sortOrder: { type: 'integer', example: 1 },
          calculatorVisible: { type: 'boolean', description: 'Можно ли добавить правило в пользовательский калькулятор', example: true }
        }
      },
      UserElementValueInput: {
        type: 'object',
        required: ['elementKey', 'amount'],
        properties: {
          elementKey: { type: 'string', example: 'gear-scraps' },
          amount: { type: 'number', minimum: 0, example: 1200 }
        }
      },
      UserElementValue: {
        allOf: [
          { $ref: '#/components/schemas/UserElementValueInput' },
          {
            type: 'object',
            required: ['userId', 'updatedAt'],
            properties: {
              userId: { type: 'integer', example: 1 },
              updatedAt: { type: 'string', format: 'date-time' }
            }
          }
        ]
      },
      UserElementValuesRequest: {
        type: 'object',
        required: ['values'],
        properties: {
          values: { type: 'array', items: { $ref: '#/components/schemas/UserElementValueInput' } }
        }
      },
      PlanItemInput: {
        type: 'object',
        required: ['ruleKey', 'amount', 'plannedAmount', 'universalAmount', 'day'],
        properties: {
          ruleKey: { type: 'string', example: 'bolt-tier-2-use' },
          amount: { type: 'number', minimum: 0, description: 'Общий запас для всех строк с этим ruleKey', example: 100 },
          plannedAmount: { type: 'number', minimum: 0, description: 'Трата в выбранный день; сумма по ruleKey не превышает amount', example: 50 },
          universalAmount: { type: 'number', minimum: 0, description: 'Универсальные минуты для исследования или строительства в этот день', example: 30 },
          day: { type: 'integer', minimum: 1, maximum: 7, example: 1 }
        }
      },
      PlanItem: {
        allOf: [
          { $ref: '#/components/schemas/PlanItemInput' },
          {
            type: 'object',
            required: ['userId', 'updatedAt'],
            properties: {
              userId: { type: 'integer', example: 1 },
              updatedAt: { type: 'string', format: 'date-time' }
            }
          }
        ]
      },
      UniversalSpeedupInput: {
        type: 'object',
        required: ['totalMinutes'],
        properties: {
          totalMinutes: { type: 'number', minimum: 0, example: 1000 }
        }
      },
      UniversalSpeedupSummary: {
        type: 'object',
        required: ['totalMinutes', 'researchMinutes', 'constructionMinutes', 'trainingMinutes', 'remainingMinutes'],
        properties: {
          totalMinutes: { type: 'number', minimum: 0, example: 1000 },
          researchMinutes: { type: 'number', minimum: 0, example: 400 },
          constructionMinutes: { type: 'number', minimum: 0, example: 300 },
          trainingMinutes: { type: 'number', minimum: 0, example: 200 },
          remainingMinutes: { type: 'number', example: 100 }
        }
      },
      TrainingPlanInput: {
        type: 'object',
        required: [
          'enabled',
          'soldierLevel',
          'currentSoldiers',
          'garrisonLimit',
          'plannedSoldiers',
          'batchLimit',
          'batchHours',
          'batchMinutes',
          'trainingSpeedupMinutes',
          'universalTrainingMinutes'
        ],
        properties: {
          enabled: { type: 'boolean', example: true },
          soldierLevel: { type: 'integer', minimum: 1, maximum: 10, example: 8 },
          currentSoldiers: { type: 'integer', minimum: 0, example: 90000 },
          garrisonLimit: { type: 'integer', minimum: 0, example: 100000 },
          plannedSoldiers: { type: 'integer', minimum: 0, example: 7080 },
          batchLimit: { type: 'integer', minimum: 0, example: 0 },
          batchHours: { type: 'integer', minimum: 0, example: 12 },
          batchMinutes: { type: 'integer', minimum: 0, maximum: 59, example: 30 },
          trainingSpeedupMinutes: { type: 'integer', minimum: 0, example: 500 },
          universalTrainingMinutes: { type: 'integer', minimum: 0, example: 250 }
        }
      },
      TrainingPlan: {
        allOf: [
          { $ref: '#/components/schemas/TrainingPlanInput' },
          {
            type: 'object',
            required: ['userId', 'updatedAt'],
            properties: {
              userId: { type: 'integer', example: 1 },
              updatedAt: { type: ['string', 'null'], format: 'date-time' }
            }
          }
        ]
      },
      CalculationRow: {
        type: 'object',
        required: ['source', 'elementKey', 'name', 'plannedAmount', 'pointsPerUnit', 'points', 'day'],
        properties: {
          source: { type: 'string', example: 'resource' },
          ruleKey: { type: ['string', 'null'] },
          elementKey: { type: 'string' },
          name: { type: 'string' },
          action: { type: 'string' },
          plannedAmount: { type: 'number' },
          pointsPerUnit: { type: 'number' },
          points: { type: 'number' },
          day: { type: 'integer', minimum: 1, maximum: 7 }
        }
      },
      UserPlanCalculation: {
        type: 'object',
        required: ['rows', 'totalPoints', 'totalsByDay', 'universalSpeedups', 'trainingPlan'],
        properties: {
          rows: { type: 'array', items: { $ref: '#/components/schemas/CalculationRow' } },
          totalPoints: { type: 'number', example: 90000 },
          totalsByDay: {
            type: 'array',
            items: {
              type: 'object',
              required: ['day', 'points'],
              properties: { day: { type: 'integer' }, points: { type: 'number' } }
            }
          },
          universalSpeedups: {
            type: 'object',
            properties: {
              totalMinutes: { type: 'number' },
              researchMinutes: { type: 'number' },
              constructionMinutes: { type: 'number' },
              trainingMinutes: { type: 'number' },
              remainingMinutes: { type: 'number' },
              points: { type: 'number' }
            }
          },
          trainingPlan: {
            allOf: [
              { $ref: '#/components/schemas/TrainingPlan' },
              {
                type: 'object',
                properties: {
                  freeCapacity: { type: 'integer' },
                  batchDurationMinutes: { type: 'integer' },
                  requiredMinutes: { type: 'integer' },
                  availableSpeedupMinutes: { type: 'integer' },
                  completedSoldiers: { type: 'integer' },
                  missingMinutes: { type: 'integer' },
                  queues: { type: 'integer' },
                  pointsPerUnit: { type: 'integer' },
                  points: { type: 'integer' }
                }
              }
            ]
          }
        }
      },
      CalculatorState: {
        type: 'object',
        required: ['planItems', 'speedups', 'trainingPlan', 'calculation'],
        properties: {
          planItems: { type: 'array', items: { $ref: '#/components/schemas/PlanItem' } },
          speedups: { $ref: '#/components/schemas/UniversalSpeedupSummary' },
          trainingPlan: { $ref: '#/components/schemas/TrainingPlan' },
          calculation: { $ref: '#/components/schemas/UserPlanCalculation' }
        }
      },
      EventContext: {
        type: 'object',
        required: ['name', 'timezone', 'note', 'eventWindows', 'dictionary'],
        properties: {
          name: { type: 'string' },
          timezone: { type: 'string', example: 'Europe/Moscow' },
          note: { type: 'string' },
          eventWindows: {
            type: 'array',
            items: {
              type: 'object',
              required: ['day', 'time', 'activity', 'overlaps'],
              properties: {
                day: { type: 'string' },
                time: { type: 'string' },
                activity: { type: 'string' },
                overlaps: { type: 'array', items: { type: 'string' } }
              }
            }
          },
          dictionary: {
            type: 'object',
            required: ['elementCount', 'ruleCount'],
            properties: {
              elementCount: { type: 'integer', example: 44 },
              ruleCount: { type: 'integer', example: 46 }
            }
          }
        }
      },
      NumberMap: {
        type: 'object',
        additionalProperties: { type: 'number', minimum: 0 },
        example: { gearScraps: 100, 'bolt-tier-1': 50, 'bolt-tier-2': 20, 'bolt-tier-3': 5 }
      },
      CalculationRequest: {
        type: 'object',
        required: ['resources', 'coefficients'],
        properties: {
          resources: { $ref: '#/components/schemas/NumberMap' },
          coefficients: { $ref: '#/components/schemas/NumberMap' }
        }
      },
      CalculationResponse: {
        type: 'object',
        required: ['rows', 'totalPoints'],
        properties: {
          rows: {
            type: 'array',
            items: {
              type: 'object',
              required: ['key', 'amount', 'coefficient', 'points'],
              properties: {
                key: { type: 'string' },
                amount: { type: 'number' },
                coefficient: { type: 'number' },
                points: { type: 'number' }
              }
            }
          },
          totalPoints: { type: 'number', example: 250 }
        }
      }
    },
    responses: {
      AuthSuccess: {
        description: 'Пользователь и токен',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } }
      },
      BadRequest: {
        description: 'Некорректные данные',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
      },
      Unauthorized: {
        description: 'Требуется корректный Bearer-токен',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
      },
      Conflict: {
        description: 'Имя пользователя уже занято',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
      }
    }
  }
};
