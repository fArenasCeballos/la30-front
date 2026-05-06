import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center space-y-4 animate-in fade-in duration-500">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center text-destructive">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold font-display">
                ¡Ups! Algo salió mal
              </h2>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                Hubo un problema al cargar este contenido. Puede ser un error
                temporal de conexión o datos.
              </p>
            </div>
            <Button
              onClick={this.handleReset}
              variant="default"
              className="gap-2"
            >
              <RefreshCcw className="h-4 w-4" />
              Recargar aplicación
            </Button>
            {import.meta.env.DEV && (
              <pre className="text-[10px] bg-muted p-4 rounded-lg mt-4 text-left overflow-auto max-w-full">
                {this.state.error?.message}
              </pre>
            )}
          </div>
        )
      );
    }

    return this.props.children;
  }
}
