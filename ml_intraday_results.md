# Out-of-Sample ML Intraday Backtest Results (CL M1-M2)

**Data:** 15-Minute Bars (Tested: Mid-April to May 2026)
**Model:** Ridge Regression Fair Value (Features: Slope, Butterfly, Volatility)
**Parameters:** Entry Z: 1.5, Exit Z: 0.3, Dynamic Risk Cushion: 0.5 Z, Rolling RMSE (3-Day)

## Portfolio Metrics
- **Total PnL:** $-8,844.61
- **Win Rate:** 33.33%
- **Total Trades:** 48
- **Average PnL per Trade:** $-184.26

## Full Trade Log
| Entry Time | Exit Time | Dir | Entry | Exit | Entry Z | Exit Z | Reason | PnL |
|---|---|---|---|---|---|---|---|---|
| 2026-04-15 14:15 | 2026-04-15 16:45 | SELL | $2.855 | $2.828 | 1.63 | 2.13 | STOP_LOSS | <span style='color: #00c48f'>+$26.88</span> |
| 2026-04-15 16:45 | 2026-04-15 18:45 | SELL | $2.828 | $3.309 | 2.13 | -0.26 | PROFIT_TARGET | <span style='color: #f43f5e'>$-480.93</span> |
| 2026-04-16 01:00 | 2026-04-16 02:00 | BUY | $3.205 | $3.190 | -8.10 | 0.02 | PROFIT_TARGET | <span style='color: #f43f5e'>$-15.00</span> |
| 2026-04-16 21:15 | 2026-04-16 23:00 | SELL | $3.695 | $3.430 | 1.55 | 2.08 | STOP_LOSS | <span style='color: #00c48f'>+$264.85</span> |
| 2026-04-16 23:00 | 2026-04-17 01:45 | SELL | $3.430 | $3.460 | 2.08 | -0.68 | PROFIT_TARGET | <span style='color: #f43f5e'>$-29.85</span> |
| 2026-04-17 02:00 | 2026-04-17 18:30 | SELL | $3.329 | $1.923 | 2.53 | 0.27 | PROFIT_TARGET | <span style='color: #00c48f'>+$1405.64</span> |
| 2026-04-18 01:00 | 2026-04-20 01:15 | SELL | $1.459 | $1.640 | 7.39 | 8.35 | STOP_LOSS | <span style='color: #f43f5e'>$-180.71</span> |
| 2026-04-20 01:15 | 2026-04-23 01:45 | SELL | $1.640 | $4.655 | 8.35 | -0.65 | PROFIT_TARGET | <span style='color: #f43f5e'>$-3015.00</span> |
| 2026-04-23 02:00 | 2026-04-23 08:15 | SELL | $4.520 | $5.038 | 1.97 | 2.50 | STOP_LOSS | <span style='color: #f43f5e'>$-518.00</span> |
| 2026-04-23 08:15 | 2026-04-23 08:30 | SELL | $5.038 | $5.020 | 2.50 | 4.45 | STOP_LOSS | <span style='color: #00c48f'>+$18.00</span> |
| 2026-04-23 08:30 | 2026-04-23 16:00 | SELL | $5.020 | $4.747 | 4.45 | 5.00 | STOP_LOSS | <span style='color: #00c48f'>+$273.33</span> |
| 2026-04-23 16:00 | 2026-04-24 00:15 | SELL | $4.747 | $5.177 | 5.00 | 5.78 | STOP_LOSS | <span style='color: #f43f5e'>$-429.83</span> |
| 2026-04-24 00:15 | 2026-04-24 01:00 | SELL | $5.177 | $5.545 | 5.78 | -6.06 | PROFIT_TARGET | <span style='color: #f43f5e'>$-368.50</span> |
| 2026-04-24 01:00 | 2026-04-24 02:00 | BUY | $5.545 | $5.128 | -6.06 | 3.90 | PROFIT_TARGET | <span style='color: #f43f5e'>$-416.67</span> |
| 2026-04-24 02:00 | 2026-04-24 04:30 | SELL | $5.128 | $5.320 | 3.90 | 4.41 | STOP_LOSS | <span style='color: #f43f5e'>$-191.44</span> |
| 2026-04-24 04:30 | 2026-04-25 01:00 | SELL | $5.320 | $5.805 | 4.41 | -4.31 | PROFIT_TARGET | <span style='color: #f43f5e'>$-485.22</span> |
| 2026-04-25 01:00 | 2026-04-27 01:30 | BUY | $5.805 | $6.555 | -4.31 | -6.18 | STOP_LOSS | <span style='color: #00c48f'>+$750.00</span> |
| 2026-04-27 01:30 | 2026-04-27 02:00 | BUY | $6.555 | $5.097 | -6.18 | 1.69 | PROFIT_TARGET | <span style='color: #f43f5e'>$-1458.00</span> |
| 2026-04-27 02:00 | 2026-04-27 07:15 | SELL | $5.097 | $4.935 | 1.69 | 2.22 | STOP_LOSS | <span style='color: #00c48f'>+$161.67</span> |
| 2026-04-27 07:15 | 2026-04-28 01:00 | SELL | $4.935 | $5.105 | 2.22 | -3.00 | PROFIT_TARGET | <span style='color: #f43f5e'>$-169.67</span> |
| 2026-04-28 01:00 | 2026-04-28 01:45 | BUY | $5.105 | $5.030 | -3.00 | -6.55 | STOP_LOSS | <span style='color: #f43f5e'>$-75.00</span> |
| 2026-04-28 01:45 | 2026-04-28 02:00 | BUY | $5.030 | $4.884 | -6.55 | 1.30 | PROFIT_TARGET | <span style='color: #f43f5e'>$-146.25</span> |
| 2026-04-28 12:30 | 2026-04-29 01:00 | SELL | $5.107 | $5.209 | 1.59 | 3.80 | STOP_LOSS | <span style='color: #f43f5e'>$-101.33</span> |
| 2026-04-29 01:00 | 2026-04-29 01:45 | SELL | $5.209 | $5.310 | 3.80 | -0.51 | PROFIT_TARGET | <span style='color: #f43f5e'>$-101.33</span> |
| 2026-04-30 01:45 | 2026-04-30 02:00 | SELL | $7.070 | $6.650 | 3.50 | -0.37 | PROFIT_TARGET | <span style='color: #00c48f'>+$420.00</span> |
| 2026-05-01 01:00 | 2026-05-01 02:00 | BUY | $5.855 | $5.740 | -7.63 | -0.20 | PROFIT_TARGET | <span style='color: #f43f5e'>$-115.00</span> |
| 2026-05-02 01:00 | 2026-05-04 01:45 | BUY | $4.632 | $4.950 | -5.03 | 1.99 | PROFIT_TARGET | <span style='color: #00c48f'>+$318.33</span> |
| 2026-05-04 01:45 | 2026-05-04 02:00 | SELL | $4.950 | $5.064 | 1.99 | -0.32 | PROFIT_TARGET | <span style='color: #f43f5e'>$-114.00</span> |
| 2026-05-05 01:45 | 2026-05-05 02:00 | BUY | $4.670 | $4.550 | -3.68 | 0.19 | PROFIT_TARGET | <span style='color: #f43f5e'>$-120.00</span> |
| 2026-05-05 17:45 | 2026-05-06 01:00 | BUY | $3.764 | $3.880 | -1.77 | 3.83 | PROFIT_TARGET | <span style='color: #00c48f'>+$116.50</span> |
| 2026-05-06 01:00 | 2026-05-06 01:45 | SELL | $3.880 | $4.460 | 3.83 | 6.39 | STOP_LOSS | <span style='color: #f43f5e'>$-580.00</span> |
| 2026-05-06 01:45 | 2026-05-06 02:00 | SELL | $4.460 | $4.247 | 6.39 | -1.49 | PROFIT_TARGET | <span style='color: #00c48f'>+$212.67</span> |
| 2026-05-06 02:45 | 2026-05-06 15:00 | BUY | $4.135 | $2.854 | -1.60 | -0.24 | PROFIT_TARGET | <span style='color: #f43f5e'>$-1280.83</span> |
| 2026-05-07 01:00 | 2026-05-07 02:00 | BUY | $4.265 | $4.150 | -12.63 | -0.21 | PROFIT_TARGET | <span style='color: #f43f5e'>$-115.00</span> |
| 2026-05-08 01:00 | 2026-05-08 01:45 | BUY | $4.585 | $4.250 | -5.82 | -7.82 | STOP_LOSS | <span style='color: #f43f5e'>$-335.00</span> |
| 2026-05-08 01:45 | 2026-05-08 02:00 | BUY | $4.250 | $4.009 | -7.82 | 0.66 | PROFIT_TARGET | <span style='color: #f43f5e'>$-240.67</span> |
| 2026-05-09 01:00 | 2026-05-11 01:45 | SELL | $3.820 | $3.660 | 4.04 | -2.30 | PROFIT_TARGET | <span style='color: #00c48f'>+$160.00</span> |
| 2026-05-11 01:45 | 2026-05-11 02:00 | BUY | $3.660 | $3.751 | -2.30 | 0.62 | PROFIT_TARGET | <span style='color: #00c48f'>+$90.50</span> |
| 2026-05-12 01:00 | 2026-05-12 01:45 | BUY | $3.393 | $3.737 | -4.48 | -5.99 | STOP_LOSS | <span style='color: #00c48f'>+$343.33</span> |
| 2026-05-12 01:45 | 2026-05-12 02:00 | BUY | $3.737 | $3.291 | -5.99 | 0.55 | PROFIT_TARGET | <span style='color: #f43f5e'>$-446.00</span> |
| 2026-05-13 01:00 | 2026-05-13 12:30 | SELL | $4.103 | $3.667 | 1.69 | 0.24 | PROFIT_TARGET | <span style='color: #00c48f'>+$436.04</span> |
| 2026-05-15 01:00 | 2026-05-15 02:00 | BUY | $4.375 | $4.234 | -8.52 | 0.66 | PROFIT_TARGET | <span style='color: #f43f5e'>$-141.00</span> |
| 2026-05-16 01:00 | 2026-05-18 02:15 | SELL | $3.923 | $4.335 | 1.91 | 0.13 | PROFIT_TARGET | <span style='color: #f43f5e'>$-411.89</span> |
| 2026-05-19 01:00 | 2026-05-19 02:00 | SELL | $4.189 | $4.465 | 2.45 | -1.35 | PROFIT_TARGET | <span style='color: #f43f5e'>$-276.43</span> |
| 2026-05-19 03:00 | 2026-05-20 01:45 | BUY | $4.767 | $5.058 | -1.51 | -3.01 | STOP_LOSS | <span style='color: #00c48f'>+$290.83</span> |
| 2026-05-20 01:45 | 2026-05-20 02:00 | BUY | $5.058 | $4.980 | -3.01 | 0.23 | PROFIT_TARGET | <span style='color: #f43f5e'>$-78.33</span> |
| 2026-05-21 01:00 | 2026-05-21 02:00 | BUY | $5.357 | $4.266 | -2.96 | 0.31 | PROFIT_TARGET | <span style='color: #f43f5e'>$-1091.79</span> |
| 2026-05-22 01:00 | 2026-05-22 06:00 | BUY | $4.100 | $3.495 | -4.22 | -0.28 | PROFIT_TARGET | <span style='color: #f43f5e'>$-604.51</span> |
