import { defineConfig } from "eslint/config";
import next from "eslint-config-next";

export default defineConfig([
  {
    extends: [...next],
    rules: {
      // Texto em português usa aspas naturais — escapar em JSX gera ruído sem benefício
      "react/no-unescaped-entities": "off",

      // useEffect(() => { setMounted(true) }, []) é o padrão correto para hidratação SSR
      // O novo eslint-config-next 16 marcou isso como erro mas é um falso positivo
      "react-hooks/set-state-in-effect": "off",

      // Componentes inline dentro do render precisam ser movidos para fora da função
      // Mantido como warn para refactor gradual sem quebrar o build
      "react-compiler": "warn",

      // Estes erros são reais e devem permanecer como erro
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
]);
