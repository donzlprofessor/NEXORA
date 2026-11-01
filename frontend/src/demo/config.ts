export const isPublicDemo = () => import.meta.env.VITE_PUBLIC_DEMO === 'true'
export const storageKey = (key: string) => (isPublicDemo() ? `nexora_public_v1_${key}` : key)
