'use server'

import { cookies, headers} from 'next/headers'
import { locales, defaultLocale } from './config'

const COOKIE_NAME = 'NEXT_LOCALE'

export async function getUserLocale() {
  //读取 cookie
  const locale = ( await cookies()).get(COOKIE_NAME)?.value;
  if(locale) return locale;

  //读取 header
  const acceptLanguage = (await headers()).get('accept-language')

  //解析 header
  const parsedLocale = acceptLanguage?.split(',')[0].split('-')[0]

  return parsedLocale && locales.includes(parsedLocale) ? parsedLocale : defaultLocale

}

export async function setUserLocale(locale: string) {
  (await cookies()).set(COOKIE_NAME, locale)
}