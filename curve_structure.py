import matplotlib.pyplot as plt
import pandas as pd

# 1. Load the data, skipping the first two header rows to get pure data
file_path = r"F:\dashboard 2\data\LCOSettle 2.csv"

# We read without headers so we can reference columns purely by their numerical positions
df = pd.read_csv(file_path, header=None, skiprows=2)

# 2. Extract and sort unique timestamps chronologically
# Column 0 contains the timestamps for the first contract (LCOc1)
raw_dates = df.iloc[:, 0].dropna().unique()

# Convert to datetime to ensure they are sorted correctly chronologically
parsed_dates = pd.to_datetime(raw_dates, errors="coerce")
date_alignment = (
    pd.DataFrame({"raw": raw_dates, "parsed": parsed_dates})
    .dropna()
    .sort_values("parsed")
)

# Select the LAST 10 most recent chronological dates
target_timestamps = date_alignment["raw"].tail(10).tolist()

# 3. Setup the plot configuration
plt.figure(figsize=(14, 8))

# Fix the deprecation warning by using plt.get_cmap
cmap = plt.get_cmap("plasma")

# 4. Iterate through each of the 10 timestamps to build the curves
for idx, target_timestamp in enumerate(target_timestamps):
    contracts = []
    prices = []

    # Loop from contract 1 to 31
    for i in range(1, 32):
        # Calculate precise column positions based on 0-indexed pairs
        ts_col_idx = 2 * (i - 1)
        price_col_idx = 2 * (i - 1) + 1

        # Ensure we don't look past the available columns in the file
        if price_col_idx < df.shape[1]:
            # Look up the target date within this specific contract's timestamp column
            row_mask = df.iloc[:, ts_col_idx] == target_timestamp

            if row_mask.any():
                price_val = df.iloc[:, price_col_idx][row_mask].values[0]

                # Clean and convert price to float, ignoring NaNs or empty spaces
                try:
                    if pd.notna(price_val) and str(price_val).strip() != "":
                        prices.append(float(price_val))
                        contracts.append(f"LCOc{i}")
                except ValueError:
                    # Skip any corrupted values safely
                    continue

    # Plot the curve for this specific timestamp
    if contracts and prices:
        # Generate a smooth color transition from oldest to newest date
        color_fraction = (
            idx / (len(target_timestamps) - 1) if len(target_timestamps) > 1 else 0
        )
        plt.plot(
            contracts,
            prices,
            marker="o",
            linestyle="-",
            linewidth=1.8,
            markersize=4,
            color=cmap(color_fraction),
            label=str(target_timestamp),
        )

# 5. Graph UI & Formatting
plt.title(
    "ICE Brent Crude Forward Curve Evolution (10 Timestamps)",
    fontsize=14,
    fontweight="bold",
    pad=15,
)
plt.xlabel(r"Contract Maturity (Front Month $\rightarrow$ Far Months)", fontsize=11)
plt.ylabel("Settlement Price ($/Bbl)", fontsize=11)
plt.xticks(rotation=45)
plt.grid(True, linestyle="--", alpha=0.5)

# Place the legend cleanly outside the plot area
plt.legend(
    title="Execution Dates",
    bbox_to_anchor=(1.02, 1),
    loc="upper left",
    borderaxespad=0,
)

plt.tight_layout()
plt.savefig("forward_curve_evolution.png", dpi=300)
plt.show()