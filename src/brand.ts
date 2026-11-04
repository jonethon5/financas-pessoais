// Nome e textos do app: a fonte é o brand.json na raiz (troque lá, num lugar só).
import brand from '../brand.json'

export const APP_NAME: string = brand.name
export const APP_TAGLINE: string = brand.tagline
export const CONTACT_EMAIL: string = brand.contactEmail
export const APP_VERSION: string = __APP_VERSION__
