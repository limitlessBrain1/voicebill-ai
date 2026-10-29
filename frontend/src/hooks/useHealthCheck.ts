import { useState, useEffect, useCallback } from 'react';
import { getBackendHealth, HealthCheckResponse } from '../services/api';

export function useHealthCheck() {
  const [data, setData] = useState<HealthCheckResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getBackendHealth();
      setData(res);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to reach backend server');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return { data, isLoading, error, refetch: checkHealth };
}
