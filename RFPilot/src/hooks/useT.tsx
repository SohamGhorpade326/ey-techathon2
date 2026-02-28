import { useTranslateProvider } from "../providers/TranslateProvider";

export const useT = () => {
  const { t, translateNow, registerText, lang, setLang } = useTranslateProvider();
  return { t, translateNow, registerText, lang, setLang };
};
