import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { Link, RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './providers/theme-provider.tsx';
// Import the generated route tree
import { routeTree } from './routeTree.gen';
import './styles/global.css';
import reportWebVitals from './reportWebVitals.ts';
import { AuthProvider } from './contexts/auth-context.tsx';
import { ErrorType, type ApiError } from './lib/utils/api-client.ts';

// Configure the query client with error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry authentication or validation errors
        if (
          (error as ApiError)?.type === ErrorType.AUTHENTICATION ||
          (error as ApiError)?.type === ErrorType.VALIDATION
        ) {
          return false;
        }
        // Don't retry most 4xx errors
        if (
          (error as ApiError)?.status &&
          (error as ApiError).status! >= 400 &&
          (error as ApiError).status! < 500
        ) {
          return false;
        }
        // Retry server and network errors up to 3 times
        return failureCount < 3;
      },
    },
    mutations: {
      // Don't retry mutations by default
      retry: false,
    },
  },
});

const RouterErrorComponent = ({ error }: { error: Error }) => {
  // Check if it's the API error type
  const isApiError = (error as ApiError)?.type !== undefined;

  return (
    <div className="p-6 max-w-xl mx-auto my-8 bg-destructive/10 border border-destructive rounded-lg">
      <h1 className="text-xl font-bold text-destructive mb-4">
        {isApiError
          ? `Error (${(error as ApiError).status ?? 'Unknown'})`
          : 'Application Error'}
      </h1>

      <div className="mb-4">
        <p className="text-foreground font-medium">{error.message}</p>

        {isApiError && (error as ApiError).requestId && (
          <p className="text-sm text-muted-foreground mt-2">
            Request ID: {(error as ApiError).requestId}
          </p>
        )}
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => (window.location.href = '/')}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Go to Homepage
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-muted text-muted-foreground rounded-md"
        >
          Retry
        </button>
      </div>
    </div>
  );
};

const NotFoundComponent = () => {
  return (
    <div className="container mx-auto flex flex-col items-center justify-center min-h-[60vh] p-6">
      <h1 className="text-4xl font-bold mb-4">Page Not Found</h1>
      <p className="text-lg text-muted-foreground mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
      >
        Return to Homepage
      </Link>
    </div>
  );
};

const router = createRouter({
  routeTree,
  context: {},
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
  defaultNotFoundComponent: () => <NotFoundComponent />,
  defaultErrorComponent: ({ error }) => <RouterErrorComponent error={error} />,
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Render the app
const rootElement = document.getElementById('app');
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider defaultTheme="system">
            <RouterProvider router={router} />
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
