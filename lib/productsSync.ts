

import { db } from './firebase'
import { collection, getDocs } from 'firebase/firestore'

function asString(value: unknown) {
    if (typeof value === "string") return value.trim()
    if (typeof value === "number") return String(value)
    return ""
}

function asNumber(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) return value

    if (typeof value === "string") {
        const parsed = Number(value.trim().replace(",", "."))
        return Number.isFinite(parsed) ? parsed : undefined
    }

    return undefined
}

export type SyncProductVariant = {
    id: string
    name: string
    sku: string
    barcode?: string
    active: boolean
    retailPrice?: number
    tradePrice?: number
    distributorPrice?: number
}

export type SyncProductRecord = {
    id: string
    name: string
    category: string
    active: boolean
    variants: SyncProductVariant[]
}

function mapVariant(variant: any): SyncProductVariant {
    const sku = asString(variant.itemNumber ?? variant.sku)
    const barcode = asString(variant.barcode)

    return {
        id: asString(variant.id),
        name: asString(variant.label ?? variant.name),
        sku,
        barcode: barcode || undefined,
        active: typeof variant.active === "boolean" ? variant.active : true,
        retailPrice: asNumber(variant.prices?.retail ?? variant.price),
        tradePrice: asNumber(variant.prices?.trade),
        distributorPrice: asNumber(variant.prices?.distributor),
    }
}

function mapProduct(doc: any): SyncProductRecord {
    return {
        id: asString(doc.id),
        name: asString(doc.name),
        category: asString(doc.category),
        active: typeof doc.active === "boolean" ? doc.active : true,
        variants: Array.isArray(doc.variants) ? doc.variants.map(mapVariant) : [],
    }
}

export async function getSyncProducts(): Promise<SyncProductRecord[]> {
    const productsCol = collection(db, 'products')
    const snapshot = await getDocs(productsCol)
    const products: SyncProductRecord[] = []
    snapshot.forEach(docSnap => {
        const data = docSnap.data()
        products.push(mapProduct({ id: docSnap.id, ...data }))
    })
    return products
}