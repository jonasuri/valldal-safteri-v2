import { Suspense } from "react";
import UtsalClient from "./UtsalClient";

export default function UtsalPage() {
    return (
        <Suspense fallback={null}>
            <UtsalClient />
        </Suspense>
    );
}