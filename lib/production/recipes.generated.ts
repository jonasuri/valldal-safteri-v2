import type { ProductionRecipe } from "./types";

export const allProductionRecipes: ProductionRecipe[] = [
    {
        "id": "sylte-1001-natt-v1",
        "name": "1001 Natt",
        "category": "Sylte",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 25,
        "primaryUnit": "kg",
        "expectedYield": 158.4,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "jordb-r-0",
                "name": "Jordbær",
                "amount": 100,
                "unit": "kg",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "vann-1",
                "name": "Vann",
                "amount": 17.599999999999998,
                "unit": "l"
            },
            {
                "id": "sukker-2",
                "name": "Sukker",
                "amount": 70,
                "unit": "kg"
            },
            {
                "id": "pektin-3",
                "name": "Pektin",
                "amount": 1848,
                "unit": "g"
            },
            {
                "id": "vaniljesukker-4",
                "name": "Vaniljesukker",
                "amount": 100,
                "unit": "g"
            },
            {
                "id": "stjerneanis-5",
                "name": "Stjerneanis",
                "amount": 160,
                "unit": "g"
            },
            {
                "id": "sitronsyre-6",
                "name": "Sitronsyre",
                "amount": 420,
                "unit": "g"
            },
            {
                "id": "benzosyre-7",
                "name": "Benzosyre",
                "amount": 110,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker og pektin"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            },
            {
                "id": "test",
                "title": "Kontroller konsistens og smak"
            },
            {
                "id": "note-1",
                "title": "Vaniljesukker og Anis"
            },
            {
                "id": "note-2",
                "title": "til slutt, smak til"
            }
        ],
        "outputs": [
            {
                "id": "1001-natt-80ml",
                "name": "1001 Natt 80 ml",
                "contentAmount": 80,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "1001-natt-10002",
                "sku": "10002",
                "name": "1001 Natt 195 ml",
                "contentAmount": 195,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    6,
                    0,
                    0,
                    0,
                    11,
                    13,
                    19,
                    35,
                    3,
                    9,
                    116,
                    13
                ]
            },
            {
                "id": "1001-natt-10003",
                "sku": "10003",
                "name": "1001 Natt 390 ml",
                "contentAmount": 390,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    2,
                    3,
                    6,
                    3,
                    4,
                    6,
                    21,
                    10,
                    0,
                    0,
                    0,
                    6
                ]
            },
            {
                "id": "1001-natt-1kg",
                "name": "1001 Natt 1 kg",
                "contentAmount": 1,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "1001-natt-2-5kg",
                "name": "1001 Natt 2,5 kg",
                "contentAmount": 2.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "1001-natt-7-5kg",
                "name": "1001 Natt 7,5 kg",
                "contentAmount": 7.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "sylte-blab-rsylte-v1",
        "name": "Blåbærsylte",
        "category": "Sylte",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 25,
        "primaryUnit": "kg",
        "expectedYield": 171.44,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "blab-r-0",
                "name": "Blåbær",
                "amount": 100,
                "unit": "kg",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "vann-1",
                "name": "Vann",
                "amount": 12.8,
                "unit": "l"
            },
            {
                "id": "sukker-2",
                "name": "Sukker",
                "amount": 81.20000000000002,
                "unit": "kg"
            },
            {
                "id": "pektin-3",
                "name": "Pektin",
                "amount": 1200,
                "unit": "g"
            },
            {
                "id": "sitronsyre-4",
                "name": "Sitronsyre",
                "amount": 172,
                "unit": "g"
            },
            {
                "id": "benzosyre-5",
                "name": "Benzosyre",
                "amount": 172,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker og pektin"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            },
            {
                "id": "test",
                "title": "Kontroller konsistens og smak"
            }
        ],
        "outputs": [
            {
                "id": "blab-rsylte-10011",
                "sku": "10011",
                "name": "Blåbærsylte 80 ml",
                "contentAmount": 80,
                "contentUnit": "ml",
                "labelsPerSheet": 14,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    8,
                    1,
                    30,
                    63,
                    108,
                    117,
                    168,
                    38,
                    26,
                    21,
                    23
                ]
            },
            {
                "id": "blab-rsylte-10012",
                "sku": "10012",
                "name": "Blåbærsylte 195 ml",
                "contentAmount": 195,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    19,
                    20,
                    10,
                    12,
                    60,
                    120,
                    122,
                    120,
                    13,
                    31,
                    13,
                    37
                ]
            },
            {
                "id": "blab-rsylte-10013",
                "sku": "10013",
                "name": "Blåbærsylte 390 ml",
                "contentAmount": 390,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    248,
                    0,
                    19,
                    0,
                    12,
                    38,
                    98,
                    55,
                    18,
                    50,
                    30,
                    16
                ]
            },
            {
                "id": "blab-rsylte-10014",
                "sku": "10014",
                "name": "Blåbærsylte 1 kg",
                "contentAmount": 1,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    1,
                    5,
                    0,
                    6,
                    5,
                    9,
                    23,
                    23,
                    3,
                    9,
                    1,
                    4
                ]
            },
            {
                "id": "blab-rsylte-10015",
                "sku": "10015",
                "name": "Blåbærsylte 2,5 kg",
                "contentAmount": 2.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    1,
                    0,
                    0,
                    6,
                    6,
                    1,
                    8,
                    9,
                    8,
                    0,
                    2,
                    2
                ]
            },
            {
                "id": "blab-rsylte-7-5kg",
                "name": "Blåbærsylte 7,5 kg",
                "contentAmount": 7.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "sylte-bringeb-rsylte-v1",
        "name": "Bringebærsylte",
        "category": "Sylte",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 24,
        "primaryUnit": "kg",
        "expectedYield": 160.21073800000002,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "bringeb-r-0",
                "name": "Bringebær",
                "amount": 100,
                "unit": "kg",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "vann-1",
                "name": "Vann",
                "amount": 6.6666669999999995,
                "unit": "l"
            },
            {
                "id": "sukker-2",
                "name": "Sukker",
                "amount": 80.44166670000001,
                "unit": "kg"
            },
            {
                "id": "pektin-3",
                "name": "Pektin",
                "amount": 1333.333,
                "unit": "g"
            },
            {
                "id": "sitronsyre-4",
                "name": "Sitronsyre",
                "amount": 345.8333,
                "unit": "g"
            },
            {
                "id": "benzosyre-5",
                "name": "Benzosyre",
                "amount": 120.83330000000002,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker og pektin"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            },
            {
                "id": "test",
                "title": "Kontroller konsistens og smak"
            }
        ],
        "outputs": [
            {
                "id": "bringeb-rsylte-10021",
                "sku": "10021",
                "name": "Bringebærsylte 80 ml",
                "contentAmount": 80,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    8,
                    1,
                    21,
                    9,
                    169,
                    120,
                    118,
                    0,
                    0,
                    22,
                    41
                ]
            },
            {
                "id": "bringeb-rsylte-10022",
                "sku": "10022",
                "name": "Bringebærsylte 195 ml",
                "contentAmount": 195,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    14,
                    6,
                    11,
                    13,
                    15,
                    87,
                    120,
                    163,
                    28,
                    1,
                    19,
                    23
                ]
            },
            {
                "id": "bringeb-rsylte-10023",
                "sku": "10023",
                "name": "Bringebærsylte 390 ml",
                "contentAmount": 390,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    335,
                    5,
                    61,
                    10,
                    25,
                    48,
                    149,
                    186,
                    16,
                    44,
                    -59,
                    76
                ]
            },
            {
                "id": "bringeb-rsylte-10024",
                "sku": "10024",
                "name": "Bringebærsylte 1 kg",
                "contentAmount": 1,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    1,
                    1,
                    7,
                    4,
                    13,
                    12,
                    41,
                    27,
                    13,
                    7,
                    0,
                    0
                ]
            },
            {
                "id": "bringeb-rsylte-10025",
                "sku": "10025",
                "name": "Bringebærsylte 2,5 kg",
                "contentAmount": 2.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    1,
                    0,
                    3,
                    6,
                    4,
                    8,
                    36,
                    20,
                    10,
                    3,
                    4,
                    0
                ]
            },
            {
                "id": "bringeb-rsylte-7-5kg",
                "name": "Bringebærsylte 7,5 kg",
                "contentAmount": 7.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "sylte-dronning-v1",
        "name": "Dronning",
        "category": "Sylte",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 20,
        "primaryUnit": "kg",
        "expectedYield": 138.45000000000002,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "bringeb-r-0",
                "name": "Bringebær",
                "amount": 60,
                "unit": "kg",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "blab-r-1",
                "name": "Blåbær",
                "amount": 40,
                "unit": "kg",
                "tracksRawMaterialBatch": true
            },
            {
                "id": "vann-2",
                "name": "Vann",
                "amount": 4,
                "unit": "l"
            },
            {
                "id": "sukker-3",
                "name": "Sukker",
                "amount": 36,
                "unit": "kg"
            },
            {
                "id": "pektin-4",
                "name": "Pektin",
                "amount": 1425,
                "unit": "g"
            },
            {
                "id": "sitronsyre-5",
                "name": "Sitronsyre",
                "amount": 180,
                "unit": "g"
            },
            {
                "id": "benzosyre-6",
                "name": "Benzosyre",
                "amount": 100,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker og pektin"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            },
            {
                "id": "test",
                "title": "Kontroller konsistens og smak"
            }
        ],
        "outputs": [
            {
                "id": "dronning-80ml",
                "name": "Dronning 80 ml",
                "contentAmount": 80,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "dronning-10032",
                "sku": "10032",
                "name": "Dronning 195 ml",
                "contentAmount": 195,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    1,
                    2,
                    12,
                    43,
                    4,
                    26,
                    54,
                    14,
                    2,
                    12,
                    1
                ]
            },
            {
                "id": "dronning-10033",
                "sku": "10033",
                "name": "Dronning 390 ml",
                "contentAmount": 390,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    6,
                    7,
                    2,
                    2,
                    0,
                    28,
                    26,
                    7,
                    1,
                    8,
                    30,
                    2
                ]
            },
            {
                "id": "dronning-1kg",
                "name": "Dronning 1 kg",
                "contentAmount": 1,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "dronning-2-5kg",
                "name": "Dronning 2,5 kg",
                "contentAmount": 2.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "dronning-7-5kg",
                "name": "Dronning 7,5 kg",
                "contentAmount": 7.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "sylte-jordb-r-og-rabarbra-v1",
        "name": "Jordbær og Rabarbra",
        "category": "Sylte",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 12.5,
        "primaryUnit": "kg",
        "expectedYield": 156.00000000000003,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "rabarbra-0",
                "name": "Rabarbra",
                "amount": 60,
                "unit": "kg",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "jordb-r-1",
                "name": "Jordbær",
                "amount": 40,
                "unit": "kg",
                "tracksRawMaterialBatch": true
            },
            {
                "id": "sukker-2",
                "name": "Sukker",
                "amount": 89.6,
                "unit": "kg"
            },
            {
                "id": "pektin-3",
                "name": "Pektin",
                "amount": 800,
                "unit": "g"
            },
            {
                "id": "sitronsyre-4",
                "name": "Sitronsyre",
                "amount": 432.0000000000001,
                "unit": "g"
            },
            {
                "id": "benzosyre-5",
                "name": "Benzosyre",
                "amount": 120,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker og pektin"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            },
            {
                "id": "test",
                "title": "Kontroller konsistens og smak"
            },
            {
                "id": "note-1",
                "title": "Kok rabarbra i 3 minutt"
            },
            {
                "id": "note-2",
                "title": "Tilsett jordbær"
            }
        ],
        "outputs": [
            {
                "id": "jordb-r-og-rabarbra-80ml",
                "name": "Jordbær og Rabarbra 80 ml",
                "contentAmount": 80,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "jordb-r-og-rabarbra-195ml",
                "name": "Jordbær og Rabarbra 195 ml",
                "contentAmount": 195,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "jordb-r-og-rabarbra-390ml",
                "name": "Jordbær og Rabarbra 390 ml",
                "contentAmount": 390,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "jordb-r-og-rabarbra-1kg",
                "name": "Jordbær og Rabarbra 1 kg",
                "contentAmount": 1,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "jordb-r-og-rabarbra-2-5kg",
                "name": "Jordbær og Rabarbra 2,5 kg",
                "contentAmount": 2.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "jordb-r-og-rabarbra-7-5kg",
                "name": "Jordbær og Rabarbra 7,5 kg",
                "contentAmount": 7.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "sylte-jordb-rsylte-v1",
        "name": "Jordbærsylte",
        "category": "Sylte",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 25,
        "primaryUnit": "kg",
        "expectedYield": 174.48,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "jordb-r-0",
                "name": "Jordbær",
                "amount": 100,
                "unit": "kg",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "vann-1",
                "name": "Vann",
                "amount": 17.599999999999998,
                "unit": "l"
            },
            {
                "id": "sukker-2",
                "name": "Sukker",
                "amount": 74,
                "unit": "kg"
            },
            {
                "id": "pektin-3",
                "name": "Pektin",
                "amount": 1848,
                "unit": "g"
            },
            {
                "id": "sitronsyre-4",
                "name": "Sitronsyre",
                "amount": 420,
                "unit": "g"
            },
            {
                "id": "benzosyre-5",
                "name": "Benzosyre",
                "amount": 40,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker og pektin"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            },
            {
                "id": "test",
                "title": "Kontroller konsistens og smak"
            },
            {
                "id": "note-1",
                "title": "Stapp jordbær før koking"
            },
            {
                "id": "note-2",
                "title": "Pass på, koker lett over"
            }
        ],
        "outputs": [
            {
                "id": "jordb-rsylte-10041",
                "sku": "10041",
                "name": "Jordbærsylte 80 ml",
                "contentAmount": 80,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    8,
                    2,
                    52,
                    13,
                    142,
                    368,
                    274,
                    36,
                    12,
                    33,
                    0
                ]
            },
            {
                "id": "jordb-rsylte-10042",
                "sku": "10042",
                "name": "Jordbærsylte 195 ml",
                "contentAmount": 195,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    14,
                    21,
                    2,
                    20,
                    49,
                    125,
                    341,
                    256,
                    53,
                    0,
                    24,
                    29
                ]
            },
            {
                "id": "jordb-rsylte-10043",
                "sku": "10043",
                "name": "Jordbærsylte 390 ml",
                "contentAmount": 390,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    250,
                    6,
                    64,
                    8,
                    23,
                    41,
                    252,
                    319,
                    24,
                    42,
                    26,
                    40
                ]
            },
            {
                "id": "jordb-rsylte-10044",
                "sku": "10044",
                "name": "Jordbærsylte 1 kg",
                "contentAmount": 1,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    4,
                    5,
                    15,
                    6,
                    11,
                    21,
                    45,
                    40,
                    17,
                    6,
                    5,
                    4
                ]
            },
            {
                "id": "jordb-rsylte-10045",
                "sku": "10045",
                "name": "Jordbærsylte 2,5 kg",
                "contentAmount": 2.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    1,
                    4,
                    4,
                    4,
                    4,
                    33,
                    14,
                    14,
                    4,
                    3,
                    0
                ]
            },
            {
                "id": "jordb-rsylte-7-5kg",
                "name": "Jordbærsylte 7,5 kg",
                "contentAmount": 7.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "sylte-kirseb-r-med-konjakk-v1",
        "name": "Kirsebær med Konjakk",
        "category": "Sylte",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 10,
        "primaryUnit": "kg",
        "expectedYield": 150.20000000000002,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "kirseb-r-0",
                "name": "Kirsebær",
                "amount": 100,
                "unit": "kg",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "vann-1",
                "name": "Vann",
                "amount": 30,
                "unit": "l"
            },
            {
                "id": "sukker-2",
                "name": "Sukker",
                "amount": 67.00000000000001,
                "unit": "kg"
            },
            {
                "id": "pektin-3",
                "name": "Pektin",
                "amount": 1360,
                "unit": "g"
            },
            {
                "id": "sitronsyre-4",
                "name": "Sitronsyre",
                "amount": 230,
                "unit": "g"
            },
            {
                "id": "benzosyre-5",
                "name": "Benzosyre",
                "amount": 100,
                "unit": "g",
                "adjustmentPercent": 50
            },
            {
                "id": "konjakk-6",
                "name": "Konjakk",
                "amount": 5,
                "unit": "l"
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker og pektin"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            },
            {
                "id": "test",
                "title": "Kontroller konsistens og smak"
            },
            {
                "id": "note-1",
                "title": "Test"
            }
        ],
        "outputs": [
            {
                "id": "kirseb-r-med-konjakk-80ml",
                "name": "Kirsebær med Konjakk 80 ml",
                "contentAmount": 80,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "kirseb-r-med-konjakk-10052",
                "sku": "10052",
                "name": "Kirsebær med Konjakk 195 ml",
                "contentAmount": 195,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    8,
                    0,
                    1,
                    1,
                    9,
                    9,
                    2,
                    5,
                    0,
                    12,
                    0,
                    56
                ]
            },
            {
                "id": "kirseb-r-med-konjakk-10053",
                "sku": "10053",
                "name": "Kirsebær med Konjakk 390 ml",
                "contentAmount": 390,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    6,
                    1,
                    0,
                    1,
                    0,
                    1
                ]
            },
            {
                "id": "kirseb-r-med-konjakk-1kg",
                "name": "Kirsebær med Konjakk 1 kg",
                "contentAmount": 1,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "kirseb-r-med-konjakk-2-5kg",
                "name": "Kirsebær med Konjakk 2,5 kg",
                "contentAmount": 2.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "kirseb-r-med-konjakk-7-5kg",
                "name": "Kirsebær med Konjakk 7,5 kg",
                "contentAmount": 7.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "sylte-kirseb-rsylte-v1",
        "name": "Kirsebærsylte",
        "category": "Sylte",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 20,
        "primaryUnit": "kg",
        "expectedYield": 152.7,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "kirseb-r-0",
                "name": "Kirsebær",
                "amount": 100,
                "unit": "kg",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "vann-1",
                "name": "Vann",
                "amount": 5,
                "unit": "l"
            },
            {
                "id": "sukker-2",
                "name": "Sukker",
                "amount": 65,
                "unit": "kg"
            },
            {
                "id": "pektin-3",
                "name": "Pektin",
                "amount": 1500,
                "unit": "g"
            },
            {
                "id": "sitronsyre-4",
                "name": "Sitronsyre",
                "amount": 200,
                "unit": "g"
            },
            {
                "id": "benzosyre-5",
                "name": "Benzosyre",
                "amount": 100,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker og pektin"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            },
            {
                "id": "test",
                "title": "Kontroller konsistens og smak"
            }
        ],
        "outputs": [
            {
                "id": "kirseb-rsylte-80ml",
                "name": "Kirsebærsylte 80 ml",
                "contentAmount": 80,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "kirseb-rsylte-10062",
                "sku": "10062",
                "name": "Kirsebærsylte 195 ml",
                "contentAmount": 195,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    25,
                    0,
                    1,
                    0,
                    8,
                    18,
                    21,
                    10,
                    5,
                    21,
                    5,
                    11
                ]
            },
            {
                "id": "kirseb-rsylte-10063",
                "sku": "10063",
                "name": "Kirsebærsylte 390 ml",
                "contentAmount": 390,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    7,
                    230,
                    158,
                    6,
                    4,
                    19,
                    39,
                    115,
                    12,
                    12,
                    27,
                    21
                ]
            },
            {
                "id": "kirseb-rsylte-10064",
                "sku": "10064",
                "name": "Kirsebærsylte 1 kg",
                "contentAmount": 1,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    1,
                    0,
                    3,
                    0,
                    0,
                    0,
                    4,
                    1,
                    5,
                    2,
                    0,
                    1
                ]
            },
            {
                "id": "kirseb-rsylte-10065",
                "sku": "10065",
                "name": "Kirsebærsylte 2,5 kg",
                "contentAmount": 2.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    1,
                    8,
                    0,
                    1,
                    1,
                    0
                ]
            },
            {
                "id": "kirseb-rsylte-7-5kg",
                "name": "Kirsebærsylte 7,5 kg",
                "contentAmount": 7.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "sylte-moltesylte-v1",
        "name": "Moltesylte",
        "category": "Sylte",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 30,
        "primaryUnit": "kg",
        "expectedYield": 154.9,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "molte-0",
                "name": "Molte",
                "amount": 100,
                "unit": "kg",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "vann-1",
                "name": "Vann",
                "amount": 15,
                "unit": "l"
            },
            {
                "id": "sukker-2",
                "name": "Sukker",
                "amount": 70,
                "unit": "kg"
            },
            {
                "id": "pektin-3",
                "name": "Pektin",
                "amount": 1125,
                "unit": "g"
            },
            {
                "id": "sitronsyre-4",
                "name": "Sitronsyre",
                "amount": 200,
                "unit": "g"
            },
            {
                "id": "benzosyre-5",
                "name": "Benzosyre",
                "amount": 88.33330000000001,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker og pektin"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            },
            {
                "id": "test",
                "title": "Kontroller konsistens og smak"
            }
        ],
        "outputs": [
            {
                "id": "moltesylte-10071",
                "sku": "10071",
                "name": "Moltesylte 80 ml",
                "contentAmount": 80,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    58,
                    0,
                    0,
                    144,
                    149,
                    239,
                    678,
                    317,
                    2,
                    10,
                    0,
                    0
                ]
            },
            {
                "id": "moltesylte-10072",
                "sku": "10072",
                "name": "Moltesylte 195 ml",
                "contentAmount": 195,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    3,
                    11,
                    39,
                    30,
                    101,
                    324,
                    424,
                    262,
                    1,
                    10,
                    0,
                    0
                ]
            },
            {
                "id": "moltesylte-10073",
                "sku": "10073",
                "name": "Moltesylte 390 ml",
                "contentAmount": 390,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    90,
                    1,
                    103,
                    7,
                    6,
                    27,
                    212,
                    0,
                    0,
                    0,
                    0,
                    0
                ]
            },
            {
                "id": "moltesylte-1kg",
                "name": "Moltesylte 1 kg",
                "contentAmount": 1,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "moltesylte-2-5kg",
                "name": "Moltesylte 2,5 kg",
                "contentAmount": 2.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "moltesylte-7-5kg",
                "name": "Moltesylte 7,5 kg",
                "contentAmount": 7.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "sylte-morgonyr-v1",
        "name": "Morgonyr",
        "category": "Sylte",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 24,
        "primaryUnit": "kg",
        "expectedYield": 162.5,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "jordb-r-0",
                "name": "Jordbær",
                "amount": 50,
                "unit": "kg",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "bringeb-r-1",
                "name": "Bringebær",
                "amount": 50,
                "unit": "kg",
                "tracksRawMaterialBatch": true
            },
            {
                "id": "vann-2",
                "name": "Vann",
                "amount": 12.5,
                "unit": "l"
            },
            {
                "id": "sukker-3",
                "name": "Sukker",
                "amount": 79.166667,
                "unit": "kg"
            },
            {
                "id": "pektin-4",
                "name": "Pektin",
                "amount": 1641.66667,
                "unit": "g"
            },
            {
                "id": "sitronsyre-5",
                "name": "Sitronsyre",
                "amount": 358.3333,
                "unit": "g"
            },
            {
                "id": "benzosyre-6",
                "name": "Benzosyre",
                "amount": 100,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker og pektin"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            },
            {
                "id": "test",
                "title": "Kontroller konsistens og smak"
            }
        ],
        "outputs": [
            {
                "id": "morgonyr-80ml",
                "name": "Morgonyr 80 ml",
                "contentAmount": 80,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "morgonyr-10082",
                "sku": "10082",
                "name": "Morgonyr 195 ml",
                "contentAmount": 195,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    3,
                    0,
                    0,
                    0,
                    1,
                    12,
                    42,
                    17,
                    7,
                    0,
                    2,
                    3
                ]
            },
            {
                "id": "morgonyr-10083",
                "sku": "10083",
                "name": "Morgonyr 390 ml",
                "contentAmount": 390,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    3,
                    0,
                    12,
                    3,
                    3,
                    5,
                    38,
                    13,
                    1,
                    9,
                    2,
                    2
                ]
            },
            {
                "id": "morgonyr-1kg",
                "name": "Morgonyr 1 kg",
                "contentAmount": 1,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "morgonyr-2-5kg",
                "name": "Morgonyr 2,5 kg",
                "contentAmount": 2.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "morgonyr-7-5kg",
                "name": "Morgonyr 7,5 kg",
                "contentAmount": 7.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "sylte-plommesylte-v1",
        "name": "Plommesylte",
        "category": "Sylte",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 40,
        "primaryUnit": "kg",
        "expectedYield": 127.49999999999999,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "plomme-0",
                "name": "Plomme",
                "amount": 100,
                "unit": "kg",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "vann-kokt-1",
                "name": "Vann Kokt",
                "amount": 8.125,
                "unit": "l"
            },
            {
                "id": "sukker-2",
                "name": "Sukker",
                "amount": 40.625,
                "unit": "kg"
            },
            {
                "id": "pektin-3",
                "name": "Pektin",
                "amount": 2009.375,
                "unit": "g"
            },
            {
                "id": "sitronsyre-4",
                "name": "Sitronsyre",
                "amount": 171.25,
                "unit": "g"
            },
            {
                "id": "benzosyre-5",
                "name": "Benzosyre",
                "amount": 110.625,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker og pektin"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            },
            {
                "id": "test",
                "title": "Kontroller konsistens og smak"
            },
            {
                "id": "note-1",
                "title": "varm lett til stein slepper,"
            },
            {
                "id": "note-2",
                "title": "sil, og hell tilbake i kjel"
            }
        ],
        "outputs": [
            {
                "id": "plommesylte-80ml",
                "name": "Plommesylte 80 ml",
                "contentAmount": 80,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "plommesylte-10092",
                "sku": "10092",
                "name": "Plommesylte 195 ml",
                "contentAmount": 195,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    0,
                    1,
                    0,
                    2,
                    12,
                    11,
                    5,
                    1,
                    0,
                    0
                ]
            },
            {
                "id": "plommesylte-10093",
                "sku": "10093",
                "name": "Plommesylte 390 ml",
                "contentAmount": 390,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    1,
                    0,
                    16,
                    13,
                    0,
                    6,
                    17,
                    31,
                    7,
                    0,
                    1,
                    0
                ]
            },
            {
                "id": "plommesylte-10094",
                "sku": "10094",
                "name": "Plommesylte 1 kg",
                "contentAmount": 1,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    1,
                    4,
                    4,
                    6,
                    7,
                    11,
                    8,
                    3,
                    3,
                    6,
                    3
                ]
            },
            {
                "id": "plommesylte-10095",
                "sku": "10095",
                "name": "Plommesylte 2,5 kg",
                "contentAmount": 2.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    1,
                    0,
                    0,
                    0,
                    0,
                    1,
                    0,
                    0,
                    0,
                    0,
                    0
                ]
            },
            {
                "id": "plommesylte-7-5kg",
                "name": "Plommesylte 7,5 kg",
                "contentAmount": 7.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "sylte-solb-rsylte-v1",
        "name": "Solbærsylte",
        "category": "Sylte",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 20,
        "maxCookPrimaryAmount": 20,
        "primaryUnit": "kg",
        "expectedYield": 266.3,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "solb-r-0",
                "name": "Solbær",
                "amount": 100,
                "unit": "kg",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "vann-1",
                "name": "Vann",
                "amount": 56.5,
                "unit": "l"
            },
            {
                "id": "sukker-2",
                "name": "Sukker",
                "amount": 146.50000000000003,
                "unit": "kg"
            },
            {
                "id": "pektin-3",
                "name": "Pektin",
                "amount": 2266.5,
                "unit": "g"
            },
            {
                "id": "sitronsyre-4",
                "name": "Sitronsyre",
                "amount": 333.00000000000006,
                "unit": "g"
            },
            {
                "id": "benzosyre-5",
                "name": "Benzosyre",
                "amount": 146.50000000000003,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker og pektin"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            },
            {
                "id": "test",
                "title": "Kontroller konsistens og smak"
            }
        ],
        "outputs": [
            {
                "id": "solb-rsylte-80ml",
                "name": "Solbærsylte 80 ml",
                "contentAmount": 80,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "solb-rsylte-10112",
                "sku": "10112",
                "name": "Solbærsylte 195 ml",
                "contentAmount": 195,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    2,
                    0,
                    0,
                    13,
                    38,
                    37,
                    254,
                    56,
                    3,
                    8,
                    17,
                    4
                ]
            },
            {
                "id": "solb-rsylte-10113",
                "sku": "10113",
                "name": "Solbærsylte 390 ml",
                "contentAmount": 390,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    225,
                    190,
                    13,
                    12,
                    17,
                    55,
                    110,
                    13,
                    18,
                    63,
                    15
                ]
            },
            {
                "id": "solb-rsylte-10114",
                "sku": "10114",
                "name": "Solbærsylte 1 kg",
                "contentAmount": 1,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    5,
                    3,
                    15,
                    12,
                    15,
                    21,
                    8,
                    7,
                    4,
                    5
                ]
            },
            {
                "id": "solb-rsylte-10115",
                "sku": "10115",
                "name": "Solbærsylte 2,5 kg",
                "contentAmount": 2.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    2,
                    0,
                    1,
                    0,
                    7,
                    4,
                    11,
                    11,
                    4,
                    2,
                    0,
                    0
                ]
            },
            {
                "id": "solb-rsylte-7-5kg",
                "name": "Solbærsylte 7,5 kg",
                "contentAmount": 7.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "sylte-soleglad-v1",
        "name": "Soleglad",
        "category": "Sylte",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 9.75,
        "primaryUnit": "kg",
        "expectedYield": 194.051282,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "bringeb-r-0",
                "name": "Bringebær",
                "amount": 61.538462,
                "unit": "kg",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "solb-r-1",
                "name": "Solbær",
                "amount": 38.470000000000006,
                "unit": "kg",
                "tracksRawMaterialBatch": true
            },
            {
                "id": "vann-2",
                "name": "Vann",
                "amount": 29.743589999999998,
                "unit": "l"
            },
            {
                "id": "sukker-3",
                "name": "Sukker",
                "amount": 107.69230800000001,
                "unit": "kg"
            },
            {
                "id": "pektin-4",
                "name": "Pektin",
                "amount": 1764.10256,
                "unit": "g"
            },
            {
                "id": "sitronsyre-5",
                "name": "Sitronsyre",
                "amount": 389.74359000000004,
                "unit": "g"
            },
            {
                "id": "benzosyre-6",
                "name": "Benzosyre",
                "amount": 35.897436,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker og pektin"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            },
            {
                "id": "test",
                "title": "Kontroller konsistens og smak"
            }
        ],
        "outputs": [
            {
                "id": "soleglad-80ml",
                "name": "Soleglad 80 ml",
                "contentAmount": 80,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "soleglad-10122",
                "sku": "10122",
                "name": "Soleglad 195 ml",
                "contentAmount": 195,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    0,
                    14,
                    30,
                    23,
                    7,
                    18,
                    2,
                    3,
                    12,
                    2
                ]
            },
            {
                "id": "soleglad-10123",
                "sku": "10123",
                "name": "Soleglad 390 ml",
                "contentAmount": 390,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    5,
                    5,
                    0,
                    6,
                    0,
                    10,
                    13,
                    11,
                    4,
                    2,
                    12,
                    7
                ]
            },
            {
                "id": "soleglad-1kg",
                "name": "Soleglad 1 kg",
                "contentAmount": 1,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "soleglad-2-5kg",
                "name": "Soleglad 2,5 kg",
                "contentAmount": 2.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "soleglad-7-5kg",
                "name": "Soleglad 7,5 kg",
                "contentAmount": 7.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "sylte-stikkelsb-rsylte-v1",
        "name": "Stikkelsbærsylte",
        "category": "Sylte",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 25,
        "primaryUnit": "kg",
        "expectedYield": 149.78336000000002,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "stikkelsb-r-0",
                "name": "Stikkelsbær",
                "amount": 100,
                "unit": "kg",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "vann-1",
                "name": "Vann",
                "amount": 6,
                "unit": "l"
            },
            {
                "id": "sukker-2",
                "name": "Sukker",
                "amount": 67.00000000000001,
                "unit": "kg"
            },
            {
                "id": "pektin-3",
                "name": "Pektin",
                "amount": 1080,
                "unit": "g"
            },
            {
                "id": "sitronsyre-4",
                "name": "Sitronsyre",
                "amount": 240,
                "unit": "g"
            },
            {
                "id": "benzosyre-5",
                "name": "Benzosyre",
                "amount": 90,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker og pektin"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 3 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            },
            {
                "id": "test",
                "title": "Kontroller konsistens og smak"
            },
            {
                "id": "note-1",
                "title": "Knus med stavmikser"
            },
            {
                "id": "note-2",
                "title": "før koking"
            }
        ],
        "outputs": [
            {
                "id": "stikkelsb-rsylte-10131",
                "sku": "10131",
                "name": "Stikkelsbærsylte 80 ml",
                "contentAmount": 80,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    0,
                    0,
                    50,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0
                ]
            },
            {
                "id": "stikkelsb-rsylte-10132",
                "sku": "10132",
                "name": "Stikkelsbærsylte 195 ml",
                "contentAmount": 195,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    6,
                    1,
                    3,
                    16,
                    49,
                    8,
                    10,
                    8,
                    6,
                    13,
                    19,
                    9
                ]
            },
            {
                "id": "stikkelsb-rsylte-10133",
                "sku": "10133",
                "name": "Stikkelsbærsylte 390 ml",
                "contentAmount": 390,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    0,
                    2,
                    13,
                    17,
                    34,
                    0,
                    6,
                    13,
                    8,
                    18
                ]
            },
            {
                "id": "stikkelsb-rsylte-1kg",
                "name": "Stikkelsbærsylte 1 kg",
                "contentAmount": 1,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "stikkelsb-rsylte-2-5kg",
                "name": "Stikkelsbærsylte 2,5 kg",
                "contentAmount": 2.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "stikkelsb-rsylte-7-5kg",
                "name": "Stikkelsbærsylte 7,5 kg",
                "contentAmount": 7.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "sylte-tytteb-rsylte-v1",
        "name": "Tyttebærsylte",
        "category": "Sylte",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 25,
        "primaryUnit": "kg",
        "expectedYield": 176.84,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "tytteb-r-0",
                "name": "Tyttebær",
                "amount": 100,
                "unit": "kg",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "vann-1",
                "name": "Vann",
                "amount": 12,
                "unit": "l"
            },
            {
                "id": "sukker-2",
                "name": "Sukker",
                "amount": 92.00000000000001,
                "unit": "kg"
            },
            {
                "id": "pektin-3",
                "name": "Pektin",
                "amount": 1384,
                "unit": "g"
            },
            {
                "id": "benzosyre-4",
                "name": "Benzosyre",
                "amount": 64,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker og pektin"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            },
            {
                "id": "test",
                "title": "Kontroller konsistens og smak"
            }
        ],
        "outputs": [
            {
                "id": "tytteb-rsylte-10141",
                "sku": "10141",
                "name": "Tyttebærsylte 80 ml",
                "contentAmount": 80,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    50,
                    0,
                    60,
                    69,
                    47,
                    99,
                    0,
                    1,
                    1,
                    0
                ]
            },
            {
                "id": "tytteb-rsylte-10142",
                "sku": "10142",
                "name": "Tyttebærsylte 195 ml",
                "contentAmount": 195,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    34,
                    2,
                    42,
                    105,
                    35,
                    45,
                    55,
                    32,
                    12,
                    47
                ]
            },
            {
                "id": "tytteb-rsylte-10143",
                "sku": "10143",
                "name": "Tyttebærsylte 390 ml",
                "contentAmount": 390,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    5,
                    0,
                    230,
                    1,
                    11,
                    7,
                    45,
                    163,
                    2,
                    21,
                    9,
                    2
                ]
            },
            {
                "id": "tytteb-rsylte-10144",
                "sku": "10144",
                "name": "Tyttebærsylte 1 kg",
                "contentAmount": 1,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    2,
                    2,
                    4,
                    5,
                    4,
                    5,
                    7,
                    5,
                    14,
                    1,
                    0,
                    5
                ]
            },
            {
                "id": "tytteb-rsylte-10145",
                "sku": "10145",
                "name": "Tyttebærsylte 2,5 kg",
                "contentAmount": 2.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    5,
                    2,
                    1,
                    0,
                    1
                ]
            },
            {
                "id": "tytteb-rsylte-7-5kg",
                "name": "Tyttebærsylte 7,5 kg",
                "contentAmount": 7.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "sylte-valldal-v1",
        "name": "Valldal",
        "category": "Sylte",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 15.7,
        "primaryUnit": "kg",
        "expectedYield": 134.14012699999998,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "jordb-r-0",
                "name": "Jordbær",
                "amount": 42.675159,
                "unit": "kg",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "bringeb-r-1",
                "name": "Bringebær",
                "amount": 38.216561,
                "unit": "kg",
                "tracksRawMaterialBatch": true
            },
            {
                "id": "blab-r-2",
                "name": "Blåbær",
                "amount": 19.10828,
                "unit": "kg",
                "tracksRawMaterialBatch": true
            },
            {
                "id": "vann-3",
                "name": "Vann",
                "amount": 4.458599,
                "unit": "l"
            },
            {
                "id": "sukker-4",
                "name": "Sukker",
                "amount": 34.394904,
                "unit": "kg"
            },
            {
                "id": "pektin-5",
                "name": "Pektin",
                "amount": 1783.43949,
                "unit": "g"
            },
            {
                "id": "sitronsyre-6",
                "name": "Sitronsyre",
                "amount": 229.299363,
                "unit": "g"
            },
            {
                "id": "benzosyre-7",
                "name": "Benzosyre",
                "amount": 95.54140100000001,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker og pektin"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            },
            {
                "id": "test",
                "title": "Kontroller konsistens og smak"
            }
        ],
        "outputs": [
            {
                "id": "valldal-80ml",
                "name": "Valldal 80 ml",
                "contentAmount": 80,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "valldal-10152",
                "sku": "10152",
                "name": "Valldal 195 ml",
                "contentAmount": 195,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    10,
                    1,
                    13,
                    30,
                    7,
                    59,
                    26,
                    10,
                    6,
                    20,
                    13
                ]
            },
            {
                "id": "valldal-10153",
                "sku": "10153",
                "name": "Valldal 390 ml",
                "contentAmount": 390,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    19,
                    9,
                    13,
                    9,
                    13,
                    27,
                    66,
                    26,
                    10,
                    23,
                    2,
                    16
                ]
            },
            {
                "id": "valldal-1kg",
                "name": "Valldal 1 kg",
                "contentAmount": 1,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "valldal-2-5kg",
                "name": "Valldal 2,5 kg",
                "contentAmount": 2.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "valldal-7-5kg",
                "name": "Valldal 7,5 kg",
                "contentAmount": 7.5,
                "contentUnit": "kg",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "saft-blab-rsaft-v1",
        "name": "Blåbærsaft",
        "category": "Saft",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 25,
        "primaryUnit": "l",
        "expectedYield": 131.68,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "blab-r-0",
                "name": "Blåbær",
                "amount": 100,
                "unit": "l",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "sukker-1",
                "name": "Sukker",
                "amount": 66.64999999999999,
                "unit": "kg"
            },
            {
                "id": "sitronsyre-2",
                "name": "Sitronsyre",
                "amount": 233.325,
                "unit": "g"
            },
            {
                "id": "benzosyre-3",
                "name": "Benzosyre",
                "amount": 43.325,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            }
        ],
        "outputs": [
            {
                "id": "blab-rsaft-13002",
                "sku": "13002",
                "name": "Blåbærsaft 0,7 l",
                "contentAmount": 0.7,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    326,
                    22,
                    44,
                    21,
                    209,
                    38,
                    159,
                    207,
                    52,
                    17,
                    -73,
                    50
                ]
            },
            {
                "id": "blab-rsaft-13003",
                "sku": "13003",
                "name": "Blåbærsaft 2,5 l",
                "contentAmount": 2.5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    5,
                    0,
                    0,
                    7,
                    1,
                    8,
                    36,
                    13,
                    11,
                    3,
                    2,
                    3
                ]
            },
            {
                "id": "blab-rsaft-13004",
                "sku": "13004",
                "name": "Blåbærsaft 5 l",
                "contentAmount": 5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    0,
                    0,
                    1,
                    4,
                    7,
                    2,
                    0,
                    1,
                    0,
                    0
                ]
            }
        ]
    },
    {
        "id": "saft-bringeb-rsaft-v1",
        "name": "Bringebærsaft",
        "category": "Saft",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 25,
        "primaryUnit": "l",
        "expectedYield": 135,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "bringeb-r-0",
                "name": "Bringebær",
                "amount": 100,
                "unit": "l",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "sukker-1",
                "name": "Sukker",
                "amount": 50,
                "unit": "kg"
            },
            {
                "id": "sitronsyre-2",
                "name": "Sitronsyre",
                "amount": 161.5,
                "unit": "g"
            },
            {
                "id": "benzosyre-3",
                "name": "Benzosyre",
                "amount": 43,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            }
        ],
        "outputs": [
            {
                "id": "bringeb-rsaft-13012",
                "sku": "13012",
                "name": "Bringebærsaft 0,7 l",
                "contentAmount": 0.7,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    322,
                    2,
                    22,
                    190,
                    44,
                    65,
                    96,
                    170,
                    34,
                    14,
                    -67,
                    28
                ]
            },
            {
                "id": "bringeb-rsaft-13013",
                "sku": "13013",
                "name": "Bringebærsaft 2,5 l",
                "contentAmount": 2.5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    0,
                    3,
                    4,
                    9,
                    16,
                    8,
                    3,
                    7,
                    2,
                    3
                ]
            },
            {
                "id": "bringeb-rsaft-13014",
                "sku": "13014",
                "name": "Bringebærsaft 5 l",
                "contentAmount": 5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    0,
                    0,
                    0,
                    14,
                    16,
                    3,
                    0,
                    0,
                    0,
                    0
                ]
            }
        ]
    },
    {
        "id": "saft-eple-og-p-re-v1",
        "name": "Eple og Pære",
        "category": "Saft",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 40,
        "primaryUnit": "l",
        "expectedYield": 118.59988000000001,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "discovery-0",
                "name": "Discovery",
                "amount": 50,
                "unit": "l",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "p-re-1",
                "name": "Pære",
                "amount": 50,
                "unit": "l",
                "tracksRawMaterialBatch": true
            },
            {
                "id": "sukker-2",
                "name": "Sukker",
                "amount": 25,
                "unit": "kg"
            },
            {
                "id": "sitronsyre-3",
                "name": "Sitronsyre",
                "amount": 220,
                "unit": "g"
            },
            {
                "id": "benzosyre-4",
                "name": "Benzosyre",
                "amount": 42.49999999999999,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            }
        ],
        "outputs": [
            {
                "id": "eple-og-p-re-0-7l",
                "name": "Eple og Pære 0,7 l",
                "contentAmount": 0.7,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "eple-og-p-re-2-5l",
                "name": "Eple og Pære 2,5 l",
                "contentAmount": 2.5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "eple-og-p-re-5l",
                "name": "Eple og Pære 5 l",
                "contentAmount": 5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "saft-eplesaft-v1",
        "name": "Eplesaft",
        "category": "Saft",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 20,
        "primaryUnit": "l",
        "expectedYield": 118.60004,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "discovery-0",
                "name": "Discovery",
                "amount": 100,
                "unit": "l",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "sukker-1",
                "name": "Sukker",
                "amount": 50,
                "unit": "kg"
            },
            {
                "id": "sitronsyre-2",
                "name": "Sitronsyre",
                "amount": 220,
                "unit": "g"
            },
            {
                "id": "benzosyre-3",
                "name": "Benzosyre",
                "amount": 44,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            }
        ],
        "outputs": [
            {
                "id": "eplesaft-13032",
                "sku": "13032",
                "name": "Eplesaft 0,7 l",
                "contentAmount": 0.7,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    6,
                    180,
                    27,
                    132,
                    117,
                    14,
                    25,
                    44,
                    2,
                    20,
                    0,
                    2
                ]
            },
            {
                "id": "eplesaft-13033",
                "sku": "13033",
                "name": "Eplesaft 2,5 l",
                "contentAmount": 2.5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    0,
                    0,
                    2,
                    6,
                    13,
                    1,
                    2,
                    0,
                    1,
                    1
                ]
            },
            {
                "id": "eplesaft-13034",
                "sku": "13034",
                "name": "Eplesaft 5 l",
                "contentAmount": 5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    0,
                    0,
                    0,
                    6,
                    1,
                    7,
                    1,
                    0,
                    0,
                    1
                ]
            }
        ]
    },
    {
        "id": "saft-jordb-rsaft-v1",
        "name": "Jordbærsaft",
        "category": "Saft",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 20,
        "primaryUnit": "l",
        "expectedYield": 112,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "jordb-r-0",
                "name": "Jordbær",
                "amount": 100,
                "unit": "l",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "sukker-1",
                "name": "Sukker",
                "amount": 29.999999999999996,
                "unit": "kg"
            },
            {
                "id": "sitronsyre-2",
                "name": "Sitronsyre",
                "amount": 300,
                "unit": "g"
            },
            {
                "id": "benzosyre-3",
                "name": "Benzosyre",
                "amount": 40,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            }
        ],
        "outputs": [
            {
                "id": "jordb-rsaft-13042",
                "sku": "13042",
                "name": "Jordbærsaft 0,7 l",
                "contentAmount": 0.7,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    188,
                    1,
                    14,
                    8,
                    1,
                    17,
                    181,
                    178,
                    12,
                    4,
                    -12,
                    26
                ]
            },
            {
                "id": "jordb-rsaft-2-5l",
                "name": "Jordbærsaft 2,5 l",
                "contentAmount": 2.5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "jordb-rsaft-5l",
                "name": "Jordbærsaft 5 l",
                "contentAmount": 5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "saft-rabarbrasaft-v1",
        "name": "Rabarbrasaft",
        "category": "Saft",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 20,
        "primaryUnit": "l",
        "expectedYield": 124.50003999999998,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "rabarbra-0",
                "name": "Rabarbra",
                "amount": 100,
                "unit": "l",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "sukker-1",
                "name": "Sukker",
                "amount": 56.64999999999999,
                "unit": "kg"
            },
            {
                "id": "sitronsyre-2",
                "name": "Sitronsyre",
                "amount": 300,
                "unit": "g"
            },
            {
                "id": "benzosyre-3",
                "name": "Benzosyre",
                "amount": 65,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            }
        ],
        "outputs": [
            {
                "id": "rabarbrasaft-13052",
                "sku": "13052",
                "name": "Rabarbrasaft 0,7 l",
                "contentAmount": 0.7,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    20,
                    12,
                    20,
                    5,
                    15,
                    68,
                    138,
                    59,
                    35,
                    22,
                    25,
                    22
                ]
            },
            {
                "id": "rabarbrasaft-2-5l",
                "name": "Rabarbrasaft 2,5 l",
                "contentAmount": 2.5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "rabarbrasaft-5l",
                "name": "Rabarbrasaft 5 l",
                "contentAmount": 5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "saft-rips-og-bringeb-r-v1",
        "name": "Rips og Bringebær",
        "category": "Saft",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 40,
        "primaryUnit": "l",
        "expectedYield": 129.5,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "bringeb-r-0",
                "name": "Bringebær",
                "amount": 50,
                "unit": "l",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "rips-1",
                "name": "Rips",
                "amount": 50,
                "unit": "l",
                "tracksRawMaterialBatch": true
            },
            {
                "id": "sukker-2",
                "name": "Sukker",
                "amount": 61,
                "unit": "kg"
            },
            {
                "id": "sitronsyre-3",
                "name": "Sitronsyre",
                "amount": 200,
                "unit": "g"
            },
            {
                "id": "benzosyre-4",
                "name": "Benzosyre",
                "amount": 44.99999999999999,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            }
        ],
        "outputs": [
            {
                "id": "rips-og-bringeb-r-13062",
                "sku": "13062",
                "name": "Rips og Bringebær 0,7 l",
                "contentAmount": 0.7,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    18,
                    2,
                    15,
                    5,
                    10,
                    32,
                    18,
                    54,
                    26,
                    0,
                    2,
                    36
                ]
            },
            {
                "id": "rips-og-bringeb-r-13063",
                "sku": "13063",
                "name": "Rips og Bringebær 2,5 l",
                "contentAmount": 2.5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    0,
                    2,
                    5,
                    1,
                    8,
                    15,
                    3,
                    0,
                    0,
                    0
                ]
            },
            {
                "id": "rips-og-bringeb-r-13064",
                "sku": "13064",
                "name": "Rips og Bringebær 5 l",
                "contentAmount": 5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    0,
                    0,
                    6,
                    9,
                    13,
                    8,
                    1,
                    1,
                    0,
                    0
                ]
            }
        ]
    },
    {
        "id": "saft-solb-rsaft-v1",
        "name": "Solbærsaft",
        "category": "Saft",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 4,
        "primaryUnit": "l",
        "expectedYield": 1228.1252,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "konsentrat-0",
                "name": "Konsentrat",
                "amount": 100,
                "unit": "l",
                "isPrimary": true
            },
            {
                "id": "vann-1",
                "name": "Vann",
                "amount": 757.4999999999999,
                "unit": "l"
            },
            {
                "id": "sukker-2",
                "name": "Sukker",
                "amount": 670,
                "unit": "kg"
            },
            {
                "id": "sitronsyre-3",
                "name": "Sitronsyre",
                "amount": 1875,
                "unit": "g"
            },
            {
                "id": "benzosyre-4",
                "name": "Benzosyre",
                "amount": 750,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            }
        ],
        "outputs": [
            {
                "id": "solb-rsaft-13072",
                "sku": "13072",
                "name": "Solbærsaft 0,7 l",
                "contentAmount": 0.7,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    4,
                    14,
                    19,
                    14,
                    33,
                    26,
                    34,
                    0,
                    0,
                    0,
                    36,
                    28
                ]
            },
            {
                "id": "solb-rsaft-13073",
                "sku": "13073",
                "name": "Solbærsaft 2,5 l",
                "contentAmount": 2.5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    0,
                    5,
                    2,
                    1,
                    7,
                    0,
                    0,
                    0,
                    0,
                    3
                ]
            },
            {
                "id": "solb-rsaft-13074",
                "sku": "13074",
                "name": "Solbærsaft 5 l",
                "contentAmount": 5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    0,
                    0,
                    0,
                    3,
                    2,
                    0,
                    0,
                    0,
                    0,
                    0
                ]
            }
        ]
    },
    {
        "id": "saft-trollsaft-v1",
        "name": "Trollsaft",
        "category": "Saft",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 20,
        "primaryUnit": "l",
        "expectedYield": 119.24991999999999,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "tytteb-r-0",
                "name": "Tyttebær",
                "amount": 100,
                "unit": "l",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "sukker-1",
                "name": "Sukker",
                "amount": 50,
                "unit": "kg"
            },
            {
                "id": "sitronsyre-2",
                "name": "Sitronsyre",
                "amount": 40,
                "unit": "g"
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            }
        ],
        "outputs": [
            {
                "id": "trollsaft-0-7l",
                "name": "Trollsaft 0,7 l",
                "contentAmount": 0.7,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "trollsaft-2-5l",
                "name": "Trollsaft 2,5 l",
                "contentAmount": 2.5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "trollsaft-5l",
                "name": "Trollsaft 5 l",
                "contentAmount": 5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "saft-vintersaft-v1",
        "name": "Vintersaft",
        "category": "Saft",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 30,
        "primaryUnit": "l",
        "expectedYield": 172.9,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "blab-r-0",
                "name": "Blåbær",
                "amount": 66,
                "unit": "l",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "solb-r-1",
                "name": "Solbær",
                "amount": 34,
                "unit": "l",
                "tracksRawMaterialBatch": true
            },
            {
                "id": "sukker-2",
                "name": "Sukker",
                "amount": 75,
                "unit": "kg"
            },
            {
                "id": "sitronsyre-3",
                "name": "Sitronsyre",
                "amount": 296.66,
                "unit": "g"
            },
            {
                "id": "benzosyre-4",
                "name": "Benzosyre",
                "amount": 56.66,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            }
        ],
        "outputs": [
            {
                "id": "vintersaft-13082",
                "sku": "13082",
                "name": "Vintersaft 0,7 l",
                "contentAmount": 0.7,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    5,
                    1,
                    12,
                    5,
                    0,
                    0,
                    9,
                    1,
                    0,
                    0,
                    25,
                    18
                ]
            },
            {
                "id": "vintersaft-2-5l",
                "name": "Vintersaft 2,5 l",
                "contentAmount": 2.5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "vintersaft-5l",
                "name": "Vintersaft 5 l",
                "contentAmount": 5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "gele-eplegele-v1",
        "name": "Eplegelé",
        "category": "Gelé",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 20,
        "primaryUnit": "l",
        "expectedYield": 172.9,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "discovery-0",
                "name": "Discovery",
                "amount": 100,
                "unit": "l",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "sukker-1",
                "name": "Sukker",
                "amount": 80,
                "unit": "kg"
            },
            {
                "id": "pektin-2",
                "name": "Pektin",
                "amount": 2411.5,
                "unit": "g"
            },
            {
                "id": "sitronsyre-3",
                "name": "Sitronsyre",
                "amount": 200,
                "unit": "g"
            },
            {
                "id": "benzosyre-4",
                "name": "Benzosyre",
                "amount": 80,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker og pektin"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            },
            {
                "id": "test",
                "title": "Kontroller konsistens og smak"
            }
        ],
        "outputs": [
            {
                "id": "eplegele-195ml",
                "name": "Eplegelé 195 ml",
                "contentAmount": 195,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "eplegele-390ml",
                "name": "Eplegelé 390 ml",
                "contentAmount": 390,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "gele-jordb-rgele-v1",
        "name": "Jordbærgelé",
        "category": "Gelé",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 20,
        "primaryUnit": "l",
        "expectedYield": 172.90000000000003,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "blab-r-rasaft-0",
                "name": "Blåbær Råsaft",
                "amount": 66.67,
                "unit": "l",
                "isPrimary": true
            },
            {
                "id": "solb-r-1",
                "name": "Solbær",
                "amount": 34,
                "unit": "l",
                "tracksRawMaterialBatch": true
            },
            {
                "id": "sukker-2",
                "name": "Sukker",
                "amount": 80.00000000000001,
                "unit": "kg"
            },
            {
                "id": "pektin-3",
                "name": "Pektin",
                "amount": 3500.0000000000005,
                "unit": "g"
            },
            {
                "id": "sitronsyre-4",
                "name": "Sitronsyre",
                "amount": 300,
                "unit": "g"
            },
            {
                "id": "benzosyre-5",
                "name": "Benzosyre",
                "amount": 55.00000000000001,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker og pektin"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            },
            {
                "id": "test",
                "title": "Kontroller konsistens og smak"
            }
        ],
        "outputs": [
            {
                "id": "jordb-rgele-195ml",
                "name": "Jordbærgelé 195 ml",
                "contentAmount": 195,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "jordb-rgele-390ml",
                "name": "Jordbærgelé 390 ml",
                "contentAmount": 390,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "gele-ripsgele-v1",
        "name": "Ripsgelé",
        "category": "Gelé",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 20,
        "primaryUnit": "l",
        "expectedYield": 135.2,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "ripssaft-0",
                "name": "Ripssaft",
                "amount": 100,
                "unit": "l",
                "isPrimary": true
            },
            {
                "id": "sukker-1",
                "name": "Sukker",
                "amount": 42.5,
                "unit": "kg"
            },
            {
                "id": "pektin-2",
                "name": "Pektin",
                "amount": 1732,
                "unit": "g"
            },
            {
                "id": "sitronsyre-3",
                "name": "Sitronsyre",
                "amount": 200,
                "unit": "g"
            },
            {
                "id": "benzosyre-4",
                "name": "Benzosyre",
                "amount": 40,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker og pektin"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            },
            {
                "id": "test",
                "title": "Kontroller konsistens og smak"
            }
        ],
        "outputs": [
            {
                "id": "ripsgele-11002",
                "sku": "11002",
                "name": "Ripsgelé 195 ml",
                "contentAmount": 195,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    1,
                    0,
                    1,
                    15,
                    21,
                    17,
                    45,
                    38,
                    8,
                    3,
                    179,
                    19
                ]
            },
            {
                "id": "ripsgele-11003",
                "sku": "11003",
                "name": "Ripsgelé 390 ml",
                "contentAmount": 390,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    156,
                    1,
                    29,
                    156,
                    20,
                    13,
                    64,
                    153,
                    5,
                    17,
                    58,
                    31
                ]
            }
        ]
    },
    {
        "id": "gele-vintergele-v1",
        "name": "Vintergelé",
        "category": "Gelé",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 20,
        "primaryUnit": "l",
        "expectedYield": 172.9,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "blab-r-rasaft-0",
                "name": "Blåbær Råsaft",
                "amount": 66.67,
                "unit": "l",
                "isPrimary": true
            },
            {
                "id": "solb-r-1",
                "name": "Solbær",
                "amount": 34,
                "unit": "l",
                "tracksRawMaterialBatch": true
            },
            {
                "id": "sukker-2",
                "name": "Sukker",
                "amount": 80,
                "unit": "kg"
            },
            {
                "id": "pektin-3",
                "name": "Pektin",
                "amount": 3500,
                "unit": "g"
            },
            {
                "id": "sitronsyre-4",
                "name": "Sitronsyre",
                "amount": 300,
                "unit": "g"
            },
            {
                "id": "benzosyre-5",
                "name": "Benzosyre",
                "amount": 55,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker og pektin"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 12 minutt"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            },
            {
                "id": "test",
                "title": "Kontroller konsistens og smak"
            }
        ],
        "outputs": [
            {
                "id": "vintergele-11012",
                "sku": "11012",
                "name": "Vintergelé 195 ml",
                "contentAmount": 195,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    0,
                    2,
                    3,
                    3,
                    3,
                    4,
                    3,
                    0,
                    80,
                    4
                ]
            },
            {
                "id": "vintergele-11013",
                "sku": "11013",
                "name": "Vintergelé 390 ml",
                "contentAmount": 390,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    1,
                    0,
                    0,
                    1,
                    1,
                    0,
                    0,
                    0,
                    0,
                    8,
                    1
                ]
            }
        ]
    },
    {
        "id": "drikkeklar-blab-r-v1",
        "name": "Blåbær",
        "category": "Frisk",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 20,
        "primaryUnit": "l",
        "expectedYield": 360.2115,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "blab-rsaft-0",
                "name": "Blåbærsaft",
                "amount": 100,
                "unit": "l",
                "isPrimary": true
            },
            {
                "id": "vann-1",
                "name": "Vann",
                "amount": 283,
                "unit": "l"
            }
        ],
        "process": [
            {
                "id": "measure",
                "title": "Mål opp og bland råvarene"
            },
            {
                "id": "heat",
                "title": "Varm opp til 80 °C utan å koke"
            },
            {
                "id": "hold",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "control",
                "title": "Kontroller smak og resultat før tapping"
            }
        ],
        "outputs": [
            {
                "id": "blab-r-15001",
                "sku": "15001",
                "name": "Blåbær 0,33 l",
                "contentAmount": 0.33,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    24,
                    48,
                    1,
                    72,
                    72,
                    256,
                    371,
                    264,
                    48,
                    49,
                    96,
                    48
                ]
            }
        ]
    },
    {
        "id": "drikkeklar-bringeb-r-v1",
        "name": "Bringebær",
        "category": "Frisk",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 20,
        "primaryUnit": "l",
        "expectedYield": 322.9171283745,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "bringeb-rsaft-0",
                "name": "Bringebærsaft",
                "amount": 100,
                "unit": "l",
                "isPrimary": true
            },
            {
                "id": "vann-1",
                "name": "Vann",
                "amount": 278,
                "unit": "l"
            }
        ],
        "process": [
            {
                "id": "measure",
                "title": "Mål opp og bland råvarene"
            },
            {
                "id": "heat",
                "title": "Varm opp til 80 °C utan å koke"
            },
            {
                "id": "hold",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "control",
                "title": "Kontroller smak og resultat før tapping"
            }
        ],
        "outputs": [
            {
                "id": "bringeb-r-15011",
                "sku": "15011",
                "name": "Bringebær 0,33 l",
                "contentAmount": 0.33,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    48,
                    50,
                    51,
                    346,
                    342,
                    408,
                    380,
                    97,
                    17,
                    144,
                    98
                ]
            }
        ]
    },
    {
        "id": "drikkeklar-hylleblomst-v1",
        "name": "Hylleblomst",
        "category": "Frisk",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 20,
        "primaryUnit": "l",
        "expectedYield": 376.2,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "hylleblomstsaft-0",
                "name": "Hylleblomstsaft",
                "amount": 100,
                "unit": "l",
                "isPrimary": true
            },
            {
                "id": "vann-1",
                "name": "Vann",
                "amount": 300,
                "unit": "l"
            }
        ],
        "process": [
            {
                "id": "measure",
                "title": "Mål opp og bland råvarene"
            },
            {
                "id": "heat",
                "title": "Varm opp til 80 °C utan å koke"
            },
            {
                "id": "hold",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "control",
                "title": "Kontroller smak og resultat før tapping"
            }
        ],
        "outputs": [
            {
                "id": "hylleblomst-0-33l",
                "name": "Hylleblomst 0,33 l",
                "contentAmount": 0.33,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "drikkeklar-jordb-r-v1",
        "name": "Jordbær",
        "category": "Frisk",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 20,
        "primaryUnit": "l",
        "expectedYield": 343.28249999999997,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "jordb-rsaft-0",
                "name": "Jordbærsaft",
                "amount": 100,
                "unit": "l",
                "isPrimary": true
            },
            {
                "id": "vann-1",
                "name": "Vann",
                "amount": 265,
                "unit": "l"
            }
        ],
        "process": [
            {
                "id": "measure",
                "title": "Mål opp og bland råvarene"
            },
            {
                "id": "heat",
                "title": "Varm opp til 80 °C utan å koke"
            },
            {
                "id": "hold",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "control",
                "title": "Kontroller smak og resultat før tapping"
            }
        ],
        "outputs": [
            {
                "id": "jordb-r-15021",
                "sku": "15021",
                "name": "Jordbær 0,33 l",
                "contentAmount": 0.33,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    48,
                    12,
                    0,
                    73,
                    82,
                    232,
                    160,
                    0,
                    0,
                    4,
                    51
                ]
            }
        ]
    },
    {
        "id": "drikkeklar-rabarbra-v1",
        "name": "Rabarbra",
        "category": "Frisk",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 20,
        "primaryUnit": "l",
        "expectedYield": 357.39,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "rabarbrasaft-0",
                "name": "Rabarbrasaft",
                "amount": 100,
                "unit": "l",
                "isPrimary": true
            },
            {
                "id": "vann-1",
                "name": "Vann",
                "amount": 280,
                "unit": "l"
            }
        ],
        "process": [
            {
                "id": "measure",
                "title": "Mål opp og bland råvarene"
            },
            {
                "id": "heat",
                "title": "Varm opp til 80 °C utan å koke"
            },
            {
                "id": "hold",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "control",
                "title": "Kontroller smak og resultat før tapping"
            }
        ],
        "outputs": [
            {
                "id": "rabarbra-15031",
                "sku": "15031",
                "name": "Rabarbra 0,33 l",
                "contentAmount": 0.33,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    2,
                    97,
                    78,
                    242,
                    408,
                    203,
                    635,
                    251,
                    8,
                    4,
                    0,
                    124
                ]
            }
        ]
    },
    {
        "id": "drikkeklar-rabarbra-sprudlande-v1",
        "name": "Rabarbra Sprudlande",
        "category": "Frisk",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 20,
        "primaryUnit": "l",
        "expectedYield": 376.2,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "rabarbrasaft-0",
                "name": "Rabarbrasaft",
                "amount": 100,
                "unit": "l",
                "isPrimary": true
            },
            {
                "id": "vann-1",
                "name": "Vann",
                "amount": 300,
                "unit": "l"
            }
        ],
        "process": [
            {
                "id": "measure",
                "title": "Mål opp og bland råvarene"
            },
            {
                "id": "heat",
                "title": "Varm opp til 80 °C utan å koke"
            },
            {
                "id": "hold",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "control",
                "title": "Kontroller smak og resultat før tapping"
            }
        ],
        "outputs": [
            {
                "id": "rabarbra-sprudlande-0-33l",
                "name": "Rabarbra Sprudlande 0,33 l",
                "contentAmount": 0.33,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "drikkeklar-trollsaft-v1",
        "name": "Trollsaft",
        "category": "Frisk",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 20,
        "primaryUnit": "l",
        "expectedYield": 357.39,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "trollsaft-0",
                "name": "Trollsaft",
                "amount": 100,
                "unit": "l",
                "isPrimary": true
            },
            {
                "id": "vann-1",
                "name": "Vann",
                "amount": 280,
                "unit": "l"
            }
        ],
        "process": [
            {
                "id": "measure",
                "title": "Mål opp og bland råvarene"
            },
            {
                "id": "heat",
                "title": "Varm opp til 80 °C utan å koke"
            },
            {
                "id": "hold",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "control",
                "title": "Kontroller smak og resultat før tapping"
            }
        ],
        "outputs": [
            {
                "id": "trollsaft-0-33l",
                "name": "Trollsaft 0,33 l",
                "contentAmount": 0.33,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "most-atlanterhavsparken-blab-r-v1",
        "name": "Atlanterhavsparken Blåbær",
        "category": "Rein",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 50,
        "recommendedProductionAmount": 100,
        "maxCookPrimaryAmount": 50,
        "primaryUnit": "l",
        "expectedYield": 93.346667,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "eple-0",
                "name": "Eple",
                "amount": 47.61904761904762,
                "unit": "l",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "blab-r-1",
                "name": "Blåbær",
                "amount": 28.57142857142857,
                "unit": "l",
                "tracksRawMaterialBatch": true
            },
            {
                "id": "p-re-2",
                "name": "Pære",
                "amount": 23.80952380952381,
                "unit": "l",
                "tracksRawMaterialBatch": true
            }
        ],
        "process": [
            {
                "id": "measure",
                "title": "Mål opp og bland råvarene"
            },
            {
                "id": "heat",
                "title": "Varm opp til 80 °C utan å koke"
            },
            {
                "id": "hold",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "control",
                "title": "Kontroller smak og resultat før tapping"
            }
        ],
        "outputs": [
            {
                "id": "atlanterhavsparken-blab-r-0-33l",
                "name": "Atlanterhavsparken Blåbær 0,33 l",
                "contentAmount": 0.33,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "atlanterhavsparken-blab-r-0-7l",
                "name": "Atlanterhavsparken Blåbær 0,7 l",
                "contentAmount": 0.7,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "atlanterhavsparken-blab-r-2-5l",
                "name": "Atlanterhavsparken Blåbær 2,5 l",
                "contentAmount": 2.5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "atlanterhavsparken-blab-r-5l",
                "name": "Atlanterhavsparken Blåbær 5 l",
                "contentAmount": 5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "most-atlanterhavsparken-bringeb-r-v1",
        "name": "Atlanterhavsparken Bringebær",
        "category": "Rein",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 50,
        "recommendedProductionAmount": 100,
        "maxCookPrimaryAmount": 50,
        "primaryUnit": "l",
        "expectedYield": 100.0064,
        "expectedYieldUnit": "l",
        "yieldConfidence": "estimated",
        "ingredients": [
            {
                "id": "eple-0",
                "name": "Eple",
                "amount": 57.6924,
                "unit": "l",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "p-re-1",
                "name": "Pære",
                "amount": 26.923999999999996,
                "unit": "l",
                "tracksRawMaterialBatch": true
            },
            {
                "id": "bringeb-r-2",
                "name": "Bringebær",
                "amount": 15.39,
                "unit": "l",
                "tracksRawMaterialBatch": true
            }
        ],
        "process": [
            {
                "id": "measure",
                "title": "Mål opp og bland råvarene"
            },
            {
                "id": "heat",
                "title": "Varm opp til 80 °C utan å koke"
            },
            {
                "id": "hold",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "control",
                "title": "Kontroller smak og resultat før tapping"
            }
        ],
        "outputs": [
            {
                "id": "atlanterhavsparken-bringeb-r-0-33l",
                "name": "Atlanterhavsparken Bringebær 0,33 l",
                "contentAmount": 0.33,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "atlanterhavsparken-bringeb-r-0-7l",
                "name": "Atlanterhavsparken Bringebær 0,7 l",
                "contentAmount": 0.7,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "atlanterhavsparken-bringeb-r-2-5l",
                "name": "Atlanterhavsparken Bringebær 2,5 l",
                "contentAmount": 2.5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "atlanterhavsparken-bringeb-r-5l",
                "name": "Atlanterhavsparken Bringebær 5 l",
                "contentAmount": 5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "most-blab-rmost-v1",
        "name": "Blåbærmost",
        "category": "Rein",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 50,
        "recommendedProductionAmount": 100,
        "maxCookPrimaryAmount": 50,
        "primaryUnit": "l",
        "expectedYield": 94,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "blab-r-0",
                "name": "Blåbær",
                "amount": 100,
                "unit": "l",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            }
        ],
        "process": [
            {
                "id": "measure",
                "title": "Mål opp og bland råvarene"
            },
            {
                "id": "heat",
                "title": "Varm opp til 80 °C utan å koke"
            },
            {
                "id": "hold",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "control",
                "title": "Kontroller smak og resultat før tapping"
            }
        ],
        "outputs": [
            {
                "id": "blab-rmost-14001",
                "sku": "14001",
                "name": "Blåbærmost 0,33 l",
                "contentAmount": 0.33,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    1,
                    53,
                    69,
                    0,
                    99,
                    73,
                    264,
                    33,
                    2,
                    0,
                    24,
                    75
                ]
            },
            {
                "id": "blab-rmost-14002",
                "sku": "14002",
                "name": "Blåbærmost 0,7 l",
                "contentAmount": 0.7,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    15,
                    0,
                    35,
                    0,
                    49,
                    3,
                    38,
                    6,
                    2,
                    6,
                    1,
                    33
                ]
            },
            {
                "id": "blab-rmost-2-5l",
                "name": "Blåbærmost 2,5 l",
                "contentAmount": 2.5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "blab-rmost-5l",
                "name": "Blåbærmost 5 l",
                "contentAmount": 5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "most-eplemost-v1",
        "name": "Eplemost",
        "category": "Rein",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 50,
        "recommendedProductionAmount": 100,
        "maxCookPrimaryAmount": 50,
        "primaryUnit": "l",
        "expectedYield": 92.99998000000001,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "aroma-0",
                "name": "Aroma",
                "amount": 66.66666599999999,
                "unit": "l",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "discovery-1",
                "name": "Discovery",
                "amount": 33.333332999999996,
                "unit": "l",
                "tracksRawMaterialBatch": true
            }
        ],
        "process": [
            {
                "id": "measure",
                "title": "Mål opp og bland råvarene"
            },
            {
                "id": "heat",
                "title": "Varm opp til 80 °C utan å koke"
            },
            {
                "id": "hold",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "control",
                "title": "Kontroller smak og resultat før tapping"
            }
        ],
        "outputs": [
            {
                "id": "eplemost-14011",
                "sku": "14011",
                "name": "Eplemost 0,33 l",
                "contentAmount": 0.33,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    48,
                    27,
                    24,
                    72,
                    105,
                    399,
                    293,
                    27,
                    24,
                    25,
                    86
                ]
            },
            {
                "id": "eplemost-14012",
                "sku": "14012",
                "name": "Eplemost 0,7 l",
                "contentAmount": 0.7,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    1,
                    1,
                    3,
                    1,
                    0,
                    2,
                    13,
                    31,
                    4,
                    0,
                    20,
                    4
                ]
            },
            {
                "id": "eplemost-14013",
                "sku": "14013",
                "name": "Eplemost 2,5 l",
                "contentAmount": 2.5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    6
                ]
            },
            {
                "id": "eplemost-5l",
                "name": "Eplemost 5 l",
                "contentAmount": 5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "most-jordb-rmost-v1",
        "name": "Jordbærmost",
        "category": "Rein",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 50,
        "recommendedProductionAmount": 100,
        "maxCookPrimaryAmount": 50,
        "primaryUnit": "l",
        "expectedYield": 94.1,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "jordb-r-0",
                "name": "Jordbær",
                "amount": 100,
                "unit": "l",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            }
        ],
        "process": [
            {
                "id": "measure",
                "title": "Mål opp og bland råvarene"
            },
            {
                "id": "heat",
                "title": "Varm opp til 80 °C utan å koke"
            },
            {
                "id": "hold",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "control",
                "title": "Kontroller smak og resultat før tapping"
            }
        ],
        "outputs": [
            {
                "id": "jordb-rmost-14021",
                "sku": "14021",
                "name": "Jordbærmost 0,33 l",
                "contentAmount": 0.33,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    2,
                    2,
                    0,
                    2,
                    0,
                    73,
                    0,
                    0,
                    0,
                    0,
                    0
                ]
            },
            {
                "id": "jordb-rmost-0-7l",
                "name": "Jordbærmost 0,7 l",
                "contentAmount": 0.7,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "jordb-rmost-2-5l",
                "name": "Jordbærmost 2,5 l",
                "contentAmount": 2.5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "jordb-rmost-5l",
                "name": "Jordbærmost 5 l",
                "contentAmount": 5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "most-trollmost-v1",
        "name": "Trollmost",
        "category": "Rein",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 50,
        "recommendedProductionAmount": 100,
        "maxCookPrimaryAmount": 50,
        "primaryUnit": "l",
        "expectedYield": 75.28,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "eple-0",
                "name": "Eple",
                "amount": 42.6672,
                "unit": "l",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "p-re-1",
                "name": "Pære",
                "amount": 16,
                "unit": "l",
                "tracksRawMaterialBatch": true
            },
            {
                "id": "tytteb-r-2",
                "name": "Tyttebær",
                "amount": 21.336,
                "unit": "l",
                "tracksRawMaterialBatch": true
            }
        ],
        "process": [
            {
                "id": "measure",
                "title": "Mål opp og bland råvarene"
            },
            {
                "id": "heat",
                "title": "Varm opp til 80 °C utan å koke"
            },
            {
                "id": "hold",
                "title": "Hald i 12 minutt"
            },
            {
                "id": "control",
                "title": "Kontroller smak og resultat før tapping"
            }
        ],
        "outputs": [
            {
                "id": "trollmost-0-33l",
                "name": "Trollmost 0,33 l",
                "contentAmount": 0.33,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "trollmost-0-7l",
                "name": "Trollmost 0,7 l",
                "contentAmount": 0.7,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "trollmost-2-5l",
                "name": "Trollmost 2,5 l",
                "contentAmount": 2.5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            },
            {
                "id": "trollmost-5l",
                "name": "Trollmost 5 l",
                "contentAmount": 5,
                "contentUnit": "l",
                "labelsPerSheet": 8,
                "forecastEnabled": false
            }
        ]
    },
    {
        "id": "saus-bringeb-rsaus-v1",
        "name": "Bringebærsaus",
        "category": "Saus",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 24,
        "primaryUnit": "l",
        "expectedYield": 119,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "bringeb-r-0",
                "name": "Bringebær",
                "amount": 100,
                "unit": "l",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "vann-1",
                "name": "Vann",
                "amount": 6.6666669999999995,
                "unit": "l"
            },
            {
                "id": "sukker-2",
                "name": "Sukker",
                "amount": 50,
                "unit": "kg"
            },
            {
                "id": "sitronsyre-3",
                "name": "Sitronsyre",
                "amount": 300,
                "unit": "g"
            },
            {
                "id": "benzosyre-4",
                "name": "Benzosyre",
                "amount": 116.66666699999999,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 12 minutt"
            },
            {
                "id": "skim",
                "title": "Skum av"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            }
        ],
        "outputs": [
            {
                "id": "bringeb-rsaus-12011",
                "sku": "12011",
                "name": "Bringebærsaus 250 ml",
                "contentAmount": 250,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    3,
                    6,
                    2,
                    7,
                    3,
                    12,
                    21,
                    12,
                    6,
                    7,
                    28,
                    62
                ]
            }
        ]
    },
    {
        "id": "saus-jordb-rsaus-v1",
        "name": "Jordbærsaus",
        "category": "Saus",
        "version": 1,
        "basisPrimaryAmount": 100,
        "preferredCookPrimaryAmount": 25,
        "primaryUnit": "l",
        "expectedYield": 119,
        "expectedYieldUnit": "l",
        "yieldConfidence": "recipe",
        "ingredients": [
            {
                "id": "jordb-r-0",
                "name": "Jordbær",
                "amount": 100,
                "unit": "l",
                "isPrimary": true,
                "tracksRawMaterialBatch": true
            },
            {
                "id": "vann-1",
                "name": "Vann",
                "amount": 11.700000000000001,
                "unit": "l"
            },
            {
                "id": "sukker-2",
                "name": "Sukker",
                "amount": 40,
                "unit": "kg"
            },
            {
                "id": "sitronsyre-3",
                "name": "Sitronsyre",
                "amount": 366.7,
                "unit": "g"
            },
            {
                "id": "benzosyre-4",
                "name": "Benzosyre",
                "amount": 91.7,
                "unit": "g",
                "adjustmentPercent": 50
            }
        ],
        "process": [
            {
                "id": "heat-1",
                "title": "Varm opp til 80 °C"
            },
            {
                "id": "sugar",
                "title": "Tilset sukker"
            },
            {
                "id": "heat-2",
                "title": "Varm opp att til 80 °C"
            },
            {
                "id": "cook",
                "title": "Kok i 12 minutt"
            },
            {
                "id": "skim",
                "title": "Skum av"
            },
            {
                "id": "acid",
                "title": "Tilset syre og benzosyre"
            }
        ],
        "outputs": [
            {
                "id": "jordb-rsaus-12001",
                "sku": "12001",
                "name": "Jordbærsaus 250 ml",
                "contentAmount": 250,
                "contentUnit": "ml",
                "labelsPerSheet": 8,
                "forecastEnabled": true,
                "monthlySales": [
                    0,
                    0,
                    3,
                    2,
                    4,
                    24,
                    32,
                    25,
                    12,
                    6,
                    1,
                    13
                ]
            }
        ]
    }
];
