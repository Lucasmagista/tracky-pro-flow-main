import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, ChevronLeft, ChevronRight, Play, SkipForward } from "lucide-react";

interface TourStep {
  id: string;
  title: string;
  description: string;
  target: string; // CSS selector
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  content?: React.ReactNode;
}

interface AppTourProps {
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
}

export const AppTour = ({ steps, onComplete, onSkip }: AppTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  useEffect(() => {
    if (!step) return;

    const targetElement = document.querySelector(step.target);
    if (!targetElement) return;

    // Scroll to element
    targetElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    });

    // Highlight element
    targetElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'rounded-lg');

    return () => {
      targetElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'rounded-lg');
    };
  }, [step]);

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    onComplete();
  };

  const handleSkip = () => {
    setIsVisible(false);
    onSkip();
  };

  if (!isVisible || !step) return null;

  const getTooltipPosition = () => {
    const targetElement = document.querySelector(step.target);
    if (!targetElement) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const rect = targetElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    switch (step.position) {
      case 'top':
        return {
          top: `${rect.top - 10}px`,
          left: `${centerX}px`,
          transform: 'translateX(-50%)',
        };
      case 'bottom':
        return {
          top: `${rect.bottom + 10}px`,
          left: `${centerX}px`,
          transform: 'translateX(-50%)',
        };
      case 'left':
        return {
          top: `${centerY}px`,
          left: `${rect.left - 10}px`,
          transform: 'translateY(-50%)',
        };
      case 'right':
        return {
          top: `${centerY}px`,
          left: `${rect.right + 10}px`,
          transform: 'translateY(-50%)',
        };
      default:
        return {
          top: `${centerY}px`,
          left: `${centerX}px`,
          transform: 'translate(-50%, -50%)',
        };
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40 pointer-events-none" />

      {/* Highlight overlay with hole */}
      <div className="fixed inset-0 z-45 pointer-events-none">
        <div className="absolute inset-0 bg-black/50" />
        {(() => {
          const targetElement = document.querySelector(step.target);
          if (!targetElement) return null;

          const rect = targetElement.getBoundingClientRect();
          return (
            <div
              className="absolute border-2 border-primary rounded-lg animate-pulse"
              style={{
                top: `${rect.top - 4}px`,
                left: `${rect.left - 4}px`,
                width: `${rect.width + 8}px`,
                height: `${rect.height + 8}px`,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
              }}
            />
          );
        })()}
      </div>

      {/* Tooltip */}
      <div
        className="fixed z-50 w-80"
        style={getTooltipPosition()}
      >
        <Card className="shadow-lg border-2 border-primary">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {currentStep + 1} de {steps.length}
                </Badge>
                <h3 className="font-semibold text-sm">{step.title}</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              {step.description}
            </p>

            {step.content && (
              <div className="mb-4">
                {step.content}
              </div>
            )}

            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevious}
                disabled={currentStep === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSkip}
                >
                  <SkipForward className="h-4 w-4 mr-1" />
                  Pular Tour
                </Button>

                <Button
                  size="sm"
                  onClick={handleNext}
                >
                  {isLastStep ? (
                    <>
                      <Play className="h-4 w-4 mr-1" />
                      Finalizar
                    </>
                  ) : (
                    <>
                      Próximo
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};