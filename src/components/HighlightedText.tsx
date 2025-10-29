import { cn } from "@/lib/utils";

interface HighlightedTextProps {
  text: string;
  highlight: string;
  className?: string;
}

/**
 * Componente para destacar texto que corresponde à busca
 */
export function HighlightedText({ text, highlight, className }: HighlightedTextProps) {
  if (!highlight || !text) {
    return <span className={className}>{text}</span>;
  }

  const parts = text.split(new RegExp(`(${highlight})`, 'gi'));

  return (
    <span className={className}>
      {parts.map((part, index) => {
        const isMatch = part.toLowerCase() === highlight.toLowerCase();
        return (
          <span
            key={index}
            className={cn(
              isMatch && "bg-yellow-200 dark:bg-yellow-900 font-semibold rounded px-0.5"
            )}
          >
            {part}
          </span>
        );
      })}
    </span>
  );
}

interface SearchResultsHeaderProps {
  totalResults: number;
  searchQuery?: string;
  hasFilters?: boolean;
}

/**
 * Cabeçalho dos resultados de busca
 */
export function SearchResultsHeader({ 
  totalResults, 
  searchQuery, 
  hasFilters 
}: SearchResultsHeaderProps) {
  if (!searchQuery && !hasFilters) return null;

  return (
    <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg border">
      <div className="flex-1">
        {searchQuery ? (
          <p className="text-sm">
            <span className="font-medium">{totalResults}</span> resultado{totalResults !== 1 ? 's' : ''} para{' '}
            <span className="font-semibold text-primary">"{searchQuery}"</span>
          </p>
        ) : (
          <p className="text-sm">
            <span className="font-medium">{totalResults}</span> resultado{totalResults !== 1 ? 's' : ''} encontrado{totalResults !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
