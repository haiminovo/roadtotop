import { zhCN, type AppCopy } from "@/lib/i18n/zh-cn";

export type SupportedLocale = "zh-CN";

export const messages: Record<SupportedLocale, AppCopy> = {
  "zh-CN": zhCN,
};

export const DEFAULT_LOCALE: SupportedLocale = "zh-CN";

export function getMessages(locale: SupportedLocale = DEFAULT_LOCALE): AppCopy {
  return messages[locale] ?? messages[DEFAULT_LOCALE];
}

function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function formatMessage(template: string, values?: Record<string, string | number>) {
  if (!values) {
    return template;
  }

  return interpolate(template, values);
}

export function getChatChannelCopy(locale: SupportedLocale, channelKey: string) {
  const copy = getMessages(locale).chat.channels;
  return copy[channelKey as keyof typeof copy] ?? null;
}

export function getRaceCopy(locale: SupportedLocale, raceKey: string) {
  const copy = getMessages(locale).data.races;
  return copy[raceKey as keyof typeof copy] ?? null;
}

export function getClassCopy(locale: SupportedLocale, classKey: string) {
  const copy = getMessages(locale).data.classes;
  return copy[classKey as keyof typeof copy] ?? null;
}

export function getMapCopy(locale: SupportedLocale, mapKey: string) {
  const copy = getMessages(locale).data.maps;
  return copy[mapKey as keyof typeof copy] ?? null;
}

export function getItemCopy(locale: SupportedLocale, itemId: string) {
  const copy = getMessages(locale).data.items;
  return copy[itemId as keyof typeof copy] ?? null;
}

export function getEncounterCopy(locale: SupportedLocale, encounterKey: string) {
  const copy = getMessages(locale).data.encounters;
  return copy[encounterKey as keyof typeof copy] ?? null;
}

export function localizeErrorMessage(locale: SupportedLocale, message: string) {
  return getMessages(locale).errors[message as keyof AppCopy["errors"]] ?? message;
}
