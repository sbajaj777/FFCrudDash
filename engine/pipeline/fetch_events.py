from gnews import GNews
import pandas as pd
import datetime
import time
import os

def classify_event(headline):
    headline_lower = headline.lower()
    if any(w in headline_lower for w in ['attack', 'missile', 'strike', 'military', 'war', 'israel', 'iran', 'drone', 'gaza']):
        return "Military Escalation"
    elif any(w in headline_lower for w in ['ship', 'tanker', 'hormuz', 'red sea', 'transit', 'vessel']):
        return "Shipping Disruption"
    elif any(w in headline_lower for w in ['sanction', 'embargo', 'ban']):
        return "Sanctions"
    elif any(w in headline_lower for w in ['opec', 'quota', 'cut']):
        return "OPEC Action"
    elif any(w in headline_lower for w in ['outage', 'refinery', 'fire', 'offline', 'disrupt']):
        return "Production Outage"
    elif any(w in headline_lower for w in ['demand', 'recession', 'growth', 'china', 'fed', 'rate']):
        return "Demand Shock"
    elif any(w in headline_lower for w in ['deal', 'peace', 'talks', 'diplomat', 'ceasefire']):
        return "Diplomatic Resolution"
    else:
        return "Macro Event"

def fetch_events(top_50_csv, output_raw_csv):
    df = pd.read_csv(top_50_csv)
    google_news = GNews(language='en', country='US', max_results=3)
    
    events = []
    event_id_counter = 1
    
    query = 'oil AND (Israel OR Iran OR OPEC OR Sanctions OR Hormuz OR "Red Sea" OR Refinery OR Production OR attack OR crude)'
    
    for _, row in df.iterrows():
        date_str = row['date']
        dt = datetime.datetime.strptime(date_str, '%Y-%m-%d')
        
        start_date = dt - datetime.timedelta(days=1)
        end_date = dt + datetime.timedelta(days=2)
        
        google_news.start_date = (start_date.year, start_date.month, start_date.day)
        google_news.end_date = (end_date.year, end_date.month, end_date.day)
        
        print(f"Fetching news for {date_str}...")
        try:
            articles = google_news.get_news(query)
            if articles:
                for art in articles[:2]:
                    headline = art['title']
                    source = art['publisher']['title']
                    event_type = classify_event(headline)
                    
                    events.append({
                        'event_id': f"EV_{event_id_counter:04d}",
                        'date': date_str,
                        'headline': headline,
                        'source': source,
                        'event_type': event_type,
                        'delta_M1_M2': row['delta_M1_M2'],
                        'delta_M2_M4': row['delta_M2_M4'],
                        'delta_M1_M6': row['delta_M1_M6'],
                        'reaction_score': row['reaction_score']
                    })
                    event_id_counter += 1
            else:
                events.append({
                    'event_id': f"EV_{event_id_counter:04d}",
                    'date': date_str,
                    'headline': f"Market volatility event around {date_str} (Placeholder)",
                    'source': "Market Data",
                    'event_type': "Macro Event",
                    'delta_M1_M2': row['delta_M1_M2'],
                    'delta_M2_M4': row['delta_M2_M4'],
                    'delta_M1_M6': row['delta_M1_M6'],
                    'reaction_score': row['reaction_score']
                })
                event_id_counter += 1
                
        except Exception as e:
            print(f"Error fetching for {date_str}: {e}")
        
        time.sleep(0.5)
        
    df_events = pd.DataFrame(events)
    df_events.to_csv(output_raw_csv, index=False)
    print(f"Saved {len(events)} events to {output_raw_csv}")

if __name__ == "__main__":
    fetch_events(r"f:\dashboard 2\engine\data\top_50_dates.csv", r"f:\dashboard 2\engine\data\historical_events.csv")
