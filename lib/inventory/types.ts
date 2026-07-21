export const DEFAULT_INVENTORY_LOCATION = "main";

export type InventoryMovementType =
    | "opening_balance"
    | "manual_adjustment"
    | "stocktake_adjustment"
    | "order_fulfillment"
    | "zettle_sale"
    | "production"
    | "return"
    | "waste";

export type InventoryMovementSource =
    | "manual"
    | "stocktake"
    | "order"
    | "zettle"
    | "production"
    | "return"
    | "system";

export type InventoryMovementMetadata = Record<
    string,
    string | number | boolean | null
>;

export type RecordInventoryMovementInput = {
    sku: string;
    quantity: number;
    type: InventoryMovementType;
    source: InventoryMovementSource;
    idempotencyKey: string;
    locationId?: string;
    productId?: string;
    variantId?: string;
    productName?: string;
    variantName?: string;
    sourceId?: string;
    note?: string;
    occurredAt?: Date;
    createdBy?: string;
    metadata?: InventoryMovementMetadata;
};

export type InventoryBalance = {
    sku: string;
    locationId: string;
    onHand: number;
    initializedAt?: unknown;
    lastMovementId?: string;
    updatedAt?: unknown;
};

export type InventoryMovement = {
    id: string;
    sku: string;
    locationId: string;
    quantity: number;
    balanceAfter: number;
    type: InventoryMovementType;
    source: InventoryMovementSource;
    idempotencyKey: string;
    productId?: string;
    variantId?: string;
    productName?: string;
    variantName?: string;
    sourceId?: string;
    note?: string;
    occurredAt?: unknown;
    createdAt?: unknown;
    createdBy?: string;
    metadata?: InventoryMovementMetadata;
};

export type InventoryAvailability = {
    onHand: number;
    openOrderQuantity: number;
    plannedProductionQuantity: number;
    projectedAvailable: number;
};

export function calculateInventoryAvailability(input: {
    onHand: number;
    openOrderQuantity?: number;
    plannedProductionQuantity?: number;
}): InventoryAvailability {
    const openOrderQuantity = input.openOrderQuantity ?? 0;
    const plannedProductionQuantity = input.plannedProductionQuantity ?? 0;

    return {
        onHand: input.onHand,
        openOrderQuantity,
        plannedProductionQuantity,
        projectedAvailable:
            input.onHand - openOrderQuantity + plannedProductionQuantity,
    };
}
