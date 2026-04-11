import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react"

type CartContextType = {
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

// eslint-disable-next-line react-refresh/only-export-components
export const useCartDrawer = () => {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error("useCartDrawer must be used within CartProvider")
  }
  return context
}

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false)

  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])
  const value = useMemo(() => ({ isOpen, openCart, closeCart }), [isOpen, openCart, closeCart])

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}

