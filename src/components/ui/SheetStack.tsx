/**
 * Sheet Stack Component
 *
 * Manages a stack of sheets for navigation.
 * Allows pushing/popping sheets like iOS navigation.
 */

import { createContext, type FunctionComponent, type ComponentChildren } from 'preact';
import { useState, useCallback, useContext } from 'preact/hooks';
import { Sheet, type SheetHeight } from './Sheet';

export interface SheetConfig {
  id: string;
  title?: string;
  height?: SheetHeight;
  content: ComponentChildren;
  onClose?: () => void;
}

interface SheetStackContextValue {
  pushSheet: (config: SheetConfig) => void;
  popSheet: () => void;
  popToRoot: () => void;
  replaceSheet: (config: SheetConfig) => void;
  sheets: SheetConfig[];
}

const SheetStackContext = createContext<SheetStackContextValue | null>(null);

export const useSheetStack = (): SheetStackContextValue => {
  const context = useContext(SheetStackContext);
  if (!context) {
    throw new Error('useSheetStack must be used within a SheetStackProvider');
  }
  return context;
};

interface SheetStackProviderProps {
  children: ComponentChildren;
}

export const SheetStackProvider: FunctionComponent<SheetStackProviderProps> = ({
  children,
}) => {
  const [sheets, setSheets] = useState<SheetConfig[]>([]);

  const pushSheet = useCallback((config: SheetConfig) => {
    setSheets((prev) => [...prev, config]);
  }, []);

  const popSheet = useCallback(() => {
    setSheets((prev) => {
      if (prev.length === 0) return prev;
      const popped = prev[prev.length - 1];
      popped.onClose?.();
      return prev.slice(0, -1);
    });
  }, []);

  const popToRoot = useCallback(() => {
    setSheets((prev) => {
      prev.forEach((sheet) => sheet.onClose?.());
      return [];
    });
  }, []);

  const replaceSheet = useCallback((config: SheetConfig) => {
    setSheets((prev) => {
      if (prev.length === 0) return [config];
      const newSheets = [...prev.slice(0, -1), config];
      return newSheets;
    });
  }, []);

  const contextValue: SheetStackContextValue = {
    pushSheet,
    popSheet,
    popToRoot,
    replaceSheet,
    sheets,
  };

  return (
    <SheetStackContext.Provider value={contextValue}>
      {children}

      {/* Render sheet stack */}
      {sheets.map((sheet) => (
        <Sheet
          key={sheet.id}
          isOpen
          onClose={popSheet}
          title={sheet.title}
          height={sheet.height}
        >
          {sheet.content}
        </Sheet>
      ))}
    </SheetStackContext.Provider>
  );
};

/**
 * Hook to open a specific sheet type
 */
export function useOpenSheet() {
  const { pushSheet, popSheet, popToRoot } = useSheetStack();

  const openSheet = useCallback((
    id: string,
    content: ComponentChildren,
    options?: { title?: string; height?: SheetHeight; onClose?: () => void }
  ) => {
    pushSheet({
      id,
      content,
      ...options,
    });
  }, [pushSheet]);

  return { openSheet, closeSheet: popSheet, closeAllSheets: popToRoot };
}

export default SheetStackProvider;
