import pyvo
import pandas as pd
import numpy as np
import os

def fetch_exoplanet_eu():
    print("Connecting to Exoplanet.eu TAP service...")
    service = pyvo.dal.TAPService("http://voparis-tap-planeto.obspm.fr/tap")
    query = "SELECT * FROM exoplanet.epn_core"
    print(f"Executing query: {query}")
    results = service.search(query)
    
    df = results.to_table().to_pandas()
    return df

def process_data():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    nasa_large_path = os.path.join(base_dir, 'nasa_export_large.csv')
    nasa_small_path = os.path.join(base_dir, 'nasa_export_small.csv')
    
    try:
        df_api = fetch_exoplanet_eu()
        print(f"Fetched {len(df_api)} rows from API.")
    except Exception as e:
        print(f"Failed to fetch data from API: {e}")
        return
    
    # 1 Jupiter Mass = 317.8 Earth Masses
    # 1 Jupiter Radius = 11.209 Earth Radii
    
    if 'mass' in df_api.columns:
        df_api['mass_earth'] = df_api['mass'] * 317.8
    if 'radius' in df_api.columns:
        df_api['radius_earth'] = df_api['radius'] * 11.209
        
    # Equilibrium temperature fallback
    if 'temp_measured' in df_api.columns and 'temp_calculated' in df_api.columns:
        df_api['eqt'] = df_api['temp_measured'].fillna(df_api['temp_calculated'])
    elif 'temp_calculated' in df_api.columns:
        df_api['eqt'] = df_api['temp_calculated']
    elif 'temp_measured' in df_api.columns:
        df_api['eqt'] = df_api['temp_measured']
    
    # Mapping to NASA columns
    column_mapping = {
        'target_name': 'pl_name',
        'star_name': 'hostname',
        'discovered': 'disc_year',
        'period': 'pl_orbper',
        'semi_major_axis': 'pl_orbsmax',
        'radius_earth': 'pl_rade',
        'mass_earth': 'pl_bmasse',
        'eqt': 'pl_eqt',
        'star_teff': 'st_teff',
        'star_radius': 'st_rad',
        'star_mass': 'st_mass',
        'star_distance': 'sy_dist',
        'log_g': 'st_logg'
    }
    
    df_mapped = df_api.rename(columns=column_mapping)
    
    # Calculate sy_pnum and sy_snum for frontend compatibility
    if 'hostname' in df_mapped.columns:
        df_mapped['sy_pnum'] = df_mapped.groupby('hostname')['hostname'].transform('count')
    else:
        df_mapped['sy_pnum'] = 1
    df_mapped['sy_snum'] = 1
    
    columns_to_keep = list(column_mapping.values()) + ['sy_pnum', 'sy_snum']
    
    existing_cols = [c for c in columns_to_keep if c in df_mapped.columns]
    df_api_only = df_mapped[existing_cols].copy()
    
    # Generate Solution 1: Pure API Dataset
    api_only_path = os.path.join(base_dir, 'api_only_export.csv')
    df_api_only.to_csv(api_only_path, index=False)
    print(f"\nLösung 1 generiert: {os.path.basename(api_only_path)}")
    
    # Generate Solution 2: Merge into NASA datasets
    # Remove duplicate target_names if any
    df_api_only = df_api_only.drop_duplicates(subset='pl_name', keep='first')
    df_api_only = df_api_only.set_index('pl_name')
    
    cols_to_fill = [
        'pl_orbper', 'pl_orbsmax', 'pl_rade', 'pl_bmasse', 
        'pl_eqt', 'st_teff', 'st_rad', 'st_mass', 'sy_dist', 'st_logg'
    ]
    
    def fill_nasa_dataset(nasa_path):
        if not os.path.exists(nasa_path):
            print(f"Überspringe {nasa_path} (nicht gefunden)")
            return
            
        print(f"\nVerarbeite {os.path.basename(nasa_path)} für Merge...")
        df_nasa = pd.read_csv(nasa_path)
        
        for col in cols_to_fill:
            if col in df_nasa.columns:
                df_nasa[col] = pd.to_numeric(df_nasa[col], errors='coerce')
        
        df_nasa = df_nasa.drop_duplicates(subset='pl_name', keep='first')
        df_nasa = df_nasa.set_index('pl_name')
        
        filled_count = 0
        for col in cols_to_fill:
            if col in df_nasa.columns and col in df_api_only.columns:
                missing_before = df_nasa[col].isna().sum()
                df_nasa[col] = df_nasa[col].fillna(df_api_only[col])
                missing_after = df_nasa[col].isna().sum()
                filled = missing_before - missing_after
                if filled > 0:
                    print(f"  - {col}: {filled} Lücken gefüllt")
                    filled_count += filled
                    
        print(f"Insgesamt {filled_count} Werte in {os.path.basename(nasa_path)} aufgefüllt.")
        
        out_path = nasa_path.replace('.csv', '_merged.csv')
        df_nasa.reset_index().to_csv(out_path, index=False)
        print(f"Erfolgreich gespeichert: {os.path.basename(out_path)}")

    fill_nasa_dataset(nasa_large_path)
    fill_nasa_dataset(nasa_small_path)
    print("\nAlle Aufgaben abgeschlossen!")

if __name__ == "__main__":
    process_data()
