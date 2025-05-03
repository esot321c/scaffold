import { type ApiError } from '@/lib/utils/api-client';

interface FormErrorProps {
  error?: ApiError | null;
  field: string;
}

export function FormError({ error, field }: FormErrorProps) {
  if (!error || !error.errors || !error.errors[field]) {
    return null;
  }

  return (
    <p className="text-destructive text-sm mt-1">{error.errors[field][0]}</p>
  );
}
