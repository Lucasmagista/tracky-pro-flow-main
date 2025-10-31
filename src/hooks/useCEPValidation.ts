import { useState, useCallback } from 'react';

export interface CEPValidationResult {
  isValid: boolean;
  data?: {
    cep: string;
    logradouro: string;
    complemento: string;
    bairro: string;
    localidade: string;
    uf: string;
    ibge: string;
    gia: string;
    ddd: string;
    siafi: string;
  };
  error?: string;
}

export interface CEPValidationResponse {
  [cep: string]: CEPValidationResult;
}

export const useCEPValidation = () => {
  const [isValidating, setIsValidating] = useState(false);

  // Validação de CEP via ViaCEP API
  const validateCEP = useCallback(async (cep: string): Promise<CEPValidationResult> => {
    // Limpar CEP (remover caracteres não numéricos)
    const cleanCEP = cep.replace(/\D/g, '');

    // Validar formato básico
    if (!cleanCEP || cleanCEP.length !== 8) {
      return {
        isValid: false,
        error: 'CEP deve ter 8 dígitos'
      };
    }

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);

      if (!response.ok) {
        return {
          isValid: false,
          error: 'Erro na consulta do CEP'
        };
      }

      const data = await response.json();

      // Verificar se o CEP foi encontrado
      if (data.erro) {
        return {
          isValid: false,
          error: 'CEP não encontrado'
        };
      }

      return {
        isValid: true,
        data: {
          cep: data.cep,
          logradouro: data.logradouro,
          complemento: data.complemento,
          bairro: data.bairro,
          localidade: data.localidade,
          uf: data.uf,
          ibge: data.ibge,
          gia: data.gia,
          ddd: data.ddd,
          siafi: data.siafi
        }
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'Erro de conexão com o serviço de CEP'
      };
    }
  }, []);

  // Validação em lote de CEPs
  const validateCEPs = useCallback(async (ceps: string[]): Promise<CEPValidationResponse> => {
    setIsValidating(true);

    try {
      const results: CEPValidationResponse = {};

      // Processar em lotes para não sobrecarregar a API
      const batchSize = 5;
      for (let i = 0; i < ceps.length; i += batchSize) {
        const batch = ceps.slice(i, i + batchSize);

        // Processar lote em paralelo
        const batchPromises = batch.map(async (cep) => {
          const result = await validateCEP(cep);
          return { cep, result };
        });

        const batchResults = await Promise.all(batchPromises);

        batchResults.forEach(({ cep, result }) => {
          results[cep] = result;
        });

        // Pequena pausa entre lotes para respeitar rate limits
        if (i + batchSize < ceps.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      return results;
    } finally {
      setIsValidating(false);
    }
  }, [validateCEP]);

  // Validação de endereço completo
  const validateAddress = useCallback(async (address: {
    cep?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
  }): Promise<{ isValid: boolean; issues: string[]; suggestions: string[] }> => {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Validar CEP se fornecido
    if (address.cep) {
      const cepResult = await validateCEP(address.cep);
      if (!cepResult.isValid) {
        issues.push(`CEP inválido: ${cepResult.error}`);
      } else if (cepResult.data) {
        // Verificar consistência dos dados
        if (address.logradouro && cepResult.data.logradouro &&
            !address.logradouro.toLowerCase().includes(cepResult.data.logradouro.toLowerCase().split(' ')[0])) {
          issues.push('Logradouro não corresponde ao CEP informado');
          suggestions.push(`Logradouro do CEP: ${cepResult.data.logradouro}`);
        }

        if (address.bairro && cepResult.data.bairro &&
            address.bairro.toLowerCase() !== cepResult.data.bairro.toLowerCase()) {
          issues.push('Bairro não corresponde ao CEP informado');
          suggestions.push(`Bairro do CEP: ${cepResult.data.bairro}`);
        }

        if (address.cidade && cepResult.data.localidade &&
            address.cidade.toLowerCase() !== cepResult.data.localidade.toLowerCase()) {
          issues.push('Cidade não corresponde ao CEP informado');
          suggestions.push(`Cidade do CEP: ${cepResult.data.localidade}`);
        }

        if (address.estado && cepResult.data.uf &&
            address.estado.toUpperCase() !== cepResult.data.uf) {
          issues.push('Estado não corresponde ao CEP informado');
          suggestions.push(`Estado do CEP: ${cepResult.data.uf}`);
        }
      }
    }

    // Validações básicas de campos obrigatórios
    if (!address.logradouro?.trim()) {
      issues.push('Logradouro é obrigatório');
    }

    if (!address.numero?.trim()) {
      issues.push('Número é obrigatório');
    }

    if (!address.bairro?.trim()) {
      issues.push('Bairro é obrigatório');
    }

    if (!address.cidade?.trim()) {
      issues.push('Cidade é obrigatória');
    }

    if (!address.estado?.trim()) {
      issues.push('Estado é obrigatório');
    } else if (address.estado.length !== 2) {
      issues.push('Estado deve ter 2 letras (UF)');
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }, [validateCEP]);

  return {
    validateCEP,
    validateCEPs,
    validateAddress,
    isValidating
  };
};