import pandas as pd
import urllib.request
import urllib.parse
import io
import os

def fetch_nasa_data():
    print("Connecting to NASA Exoplanet Archive TAP service...")
    
    columns = [
        'pl_name', 'hostname', 'sy_snum', 'sy_pnum', 'sy_mnum', 
        'cb_flag', 'discoverymethod', 'disc_year', 
        'pl_orbper', 'pl_orbsmax', 'pl_rade', 'pl_radj', 
        'pl_bmasse', 'pl_bmassj', 'pl_orbeccen', 
        'pl_insol', 'pl_eqt', 'pl_dens', 'pl_orbincl', 
        'st_teff', 'st_rad', 'st_mass', 'st_met', 'st_logg', 
        'st_age', 'st_dens', 
        'sy_dist', 'sy_vmag', 'sy_kmag', 'sy_gaiamag'
    ]
    
    query = f"select {','.join(columns)} from pscomppars"
    url = f"https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query={urllib.parse.quote(query)}&format=csv"
    
    print("Executing query...")
    try:
        response = urllib.request.urlopen(url)
        df = pd.read_csv(io.StringIO(response.read().decode('utf-8')))
        print(f"Successfully fetched {len(df)} rows from NASA API.")
        return df
    except Exception as e:
        print(f"Failed to fetch data from API: {e}")
        return None

def main():
    df = fetch_nasa_data()
    if df is not None:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        out_path = os.path.join(base_dir, 'nasa_export_full.csv')
        df.to_csv(out_path, index=False)
        print(f"Saved dataset with {len(df.columns)} columns to {os.path.basename(out_path)}")

if __name__ == "__main__":
    main()
