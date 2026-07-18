import pandas as pd
import os

def merge_datasets():
    print("Starte Daten-Merge...")
    
    # Pfade relativ zum Script-Speicherort
    base_dir = os.path.dirname(os.path.abspath(__file__))
    nasa_large_path = os.path.join(base_dir, 'nasa_export_large.csv')
    nasa_small_path = os.path.join(base_dir, 'nasa_export_small.csv')
    alt_data_path = os.path.join(base_dir, 'all_exoplanets_2021.csv')
    
    # Lade alternativen Datensatz
    print("Lade all_exoplanets_2021.csv...")
    try:
        df_alt = pd.read_csv(alt_data_path)
    except FileNotFoundError:
        print(f"Fehler: {alt_data_path} nicht gefunden.")
        return
        
    # Mapping der Spaltennamen von 'all_exoplanets_2021.csv' zu NASA-Spalten
    # Hinweis: 'Planet Radius' fehlt im alternativen Datensatz leider!
    column_mapping = {
        'Planet Name': 'pl_name',
        'Orbital Period Days': 'pl_orbper',
        'Orbit Semi-Major Axis': 'pl_orbsmax',
        'Mass': 'pl_bmasse',
        'Insolation Flux': 'pl_insol',
        'Equilibrium Temperature': 'pl_eqt',
        'Stellar Effective Temperature': 'st_teff',
        'Stellar Radius': 'st_rad',
        'Stellar Mass': 'st_mass',
        'Distance': 'sy_dist'
    }
    
    df_alt = df_alt.rename(columns=column_mapping)
    df_alt = df_alt.set_index('pl_name')
    
    # NASA-Spalten, die wir auffüllen wollen
    cols_to_fill = [
        'pl_orbper', 'pl_orbsmax', 'pl_bmasse', 'pl_insol', 
        'pl_eqt', 'st_teff', 'st_rad', 'st_mass', 'sy_dist'
    ]
    
    # Funktion zum Auffüllen
    def fill_nasa_dataset(nasa_path):
        if not os.path.exists(nasa_path):
            print(f"Überspringe {nasa_path} (nicht gefunden)")
            return
            
        print(f"\nVerarbeite {os.path.basename(nasa_path)}...")
        df_nasa = pd.read_csv(nasa_path)
        
        # Leere/fehlerhafte Strings in NaN umwandeln falls vorhanden
        for col in cols_to_fill:
            if col in df_nasa.columns:
                df_nasa[col] = pd.to_numeric(df_nasa[col], errors='coerce')
        
        df_nasa = df_nasa.set_index('pl_name')
        
        # Auffüllen der Lücken
        filled_count = 0
        for col in cols_to_fill:
            if col in df_nasa.columns and col in df_alt.columns:
                missing_before = df_nasa[col].isna().sum()
                df_nasa[col] = df_nasa[col].fillna(df_alt[col])
                missing_after = df_nasa[col].isna().sum()
                filled = missing_before - missing_after
                if filled > 0:
                    print(f"  - {col}: {filled} Lücken gefüllt")
                    filled_count += filled
                    
        print(f"Insgesamt {filled_count} Werte aufgefüllt.")
        
        # Speichern in neue Datei
        out_path = nasa_path.replace('.csv', '_merged.csv')
        df_nasa.reset_index().to_csv(out_path, index=False)
        print(f"Erfolgreich gespeichert: {os.path.basename(out_path)}")

    # Beide Dateien verarbeiten
    fill_nasa_dataset(nasa_large_path)
    fill_nasa_dataset(nasa_small_path)
    
    print("\nFertig! Die NASA-Datensätze wurden aktualisiert.")

if __name__ == "__main__":
    merge_datasets()
