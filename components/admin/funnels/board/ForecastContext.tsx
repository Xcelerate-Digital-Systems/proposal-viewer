'use client';

import { createContext, useContext } from 'react';
import type { Forecast } from '@/lib/funnel/forecast';

export const ForecastCtx = createContext<Forecast | null>(null);
export function useForecast() { return useContext(ForecastCtx); }
