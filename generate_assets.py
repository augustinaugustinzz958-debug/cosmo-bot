import os
import math
import random
from PIL import Image, ImageDraw, ImageFilter

def create_folders():
    folders = ['assets/planets', 'assets/rocket', 'assets/ai', 'assets/effects']
    for f in folders:
        os.makedirs(f, exist_ok=True)

def generate_noise(width, height, factor=0.15):
    img = Image.new('RGB', (width, height), (0, 0, 0))
    pixels = img.load()
    for x in range(width):
        for y in range(height):
            v = int(random.random() * 255 * factor)
            pixels[x, y] = (v, v, v)
    return img

# 1. Generate starfield background texture
def make_starfield():
    print("Generating starfield...")
    width, height = 1024, 1024
    img = Image.new('RGBA', (width, height), (3, 5, 12, 255))
    draw = ImageDraw.Draw(img)
    # Tiny stars
    for _ in range(300):
        x = random.randint(0, width - 1)
        y = random.randint(0, height - 1)
        size = random.choice([1, 2, 3])
        r = random.randint(220, 255)
        g = random.randint(220, 255)
        b = random.randint(240, 255)
        alpha = random.randint(180, 255)
        draw.ellipse([x, y, x + size - 1, y + size - 1], fill=(r, g, b, alpha))
    
    # Glowing stars
    for _ in range(12):
        x = random.randint(0, width - 1)
        y = random.randint(0, height - 1)
        size = random.randint(4, 7)
        draw.ellipse([x - size, y - size, x + size, y + size], fill=(255, 255, 255, 80))
        draw.ellipse([x - 1, y - size*2, x + 1, y + size*2], fill=(255, 255, 255, 150))
        draw.ellipse([x - size*2, y - 1, x + size*2, y + 1], fill=(255, 255, 255, 150))
        draw.ellipse([x - 1, y - 1, x + 1, y + 1], fill=(255, 255, 255, 255))
        
    img.save('assets/effects/starfield.png', 'PNG')

# 2. Generate colorful space nebula
def make_nebula():
    print("Generating nebula...")
    w, h = 512, 512
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    pixels = img.load()
    
    cx1, cy1 = w * 0.3, h * 0.4
    cx2, cy2 = w * 0.7, h * 0.6
    
    for x in range(w):
        for y in range(h):
            d1 = math.hypot(x - cx1, y - cy1) / (w * 0.5)
            d2 = math.hypot(x - cx2, y - cy2) / (w * 0.4)
            
            # Complex colors
            r = int(max(0, 180 * (1.0 - d1) * (0.8 + 0.2 * math.sin(x*0.05 + y*0.03))))
            g = int(max(0, 120 * (1.0 - d2) * (0.7 + 0.3 * math.cos(x*0.02 - y*0.04))))
            b = int(max(0, 230 * (1.0 - d1*0.8) * (1.0 - d2*0.6)))
            
            a = int(min(255, max(0, 160 * (1.0 - d1) + 120 * (1.0 - d2))))
            if a > 10:
                pixels[x, y] = (r, g, b, a)
                
    img = img.filter(ImageFilter.GaussianBlur(15))
    img.save('assets/effects/nebula.png', 'PNG')

# 3. Generate swirling wormhole vortex
def make_wormhole():
    print("Generating wormhole...")
    w, h = 512, 512
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = w // 2, h // 2
    # Draw concentric spiraling arms
    for i in range(120):
        angle = i * 0.3
        radius = i * 2.2
        x = int(cx + radius * math.cos(angle))
        y = int(cy + radius * math.sin(angle))
        size = random.randint(4, 18) - int(i * 0.08)
        size = max(2, size)
        
        # Color shifting
        r = int(120 + 135 * math.sin(angle * 0.5))
        g = int(50 + 200 * math.cos(angle * 0.8))
        b = int(220 + 35 * math.sin(angle))
        a = int(255 * (1.0 - (i / 120.0)))
        
        draw.ellipse([x - size, y - size, x + size, y + size], fill=(r, g, b, a))
        
    img = img.filter(ImageFilter.GaussianBlur(8))
    img.save('assets/effects/wormhole.png', 'PNG')

# 4. Generate planet textures
def make_planets():
    planet_details = [
        # name, color, detail_type (craters, clouds, bands, etc.)
        ('moon', '#80848a', 'craters'),
        ('mercury', '#9c8c7c', 'craters'),
        ('venus', '#e3a857', 'clouds'),
        ('earth', '#2060cf', 'earth_map'),
        ('mars', '#d15332', 'mars_map'),
        ('jupiter', '#bf7a50', 'bands'),
        ('saturn', '#e6c88e', 'bands'),
        ('uranus', '#7cd6d6', 'gas'),
        ('neptune', '#3250b5', 'gas')
    ]
    
    w, h = 512, 256
    
    for name, base_color, detail in planet_details:
        print(f"Generating planet texture: {name}...")
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Parse hex color
        rgb = tuple(int(base_color.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
        draw.rectangle([0, 0, w, h], fill=(*rgb, 255))
        
        if detail == 'craters':
            # Draw gray craters
            for _ in range(50):
                cx = random.randint(0, w)
                cy = random.randint(0, h)
                r = random.randint(5, 18)
                dark_c = tuple(int(c * 0.72) for c in rgb)
                light_c = tuple(int(min(255, c * 1.25)) for c in rgb)
                # Outer shadow
                draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*dark_c, 255))
                # Inner highlight
                draw.ellipse([cx - r + 2, cy - r + 2, cx + r - 1, cy + r - 1], fill=(*light_c, 255))
                # Core
                draw.ellipse([cx - r + 3, cy - r + 3, cx + r - 3, cy + r - 3], fill=(*dark_c, 255))
                
        elif detail == 'clouds':
            # Sinuous swirling acid clouds
            for y in range(0, h, 8):
                offset = int(math.sin(y * 0.1) * 35)
                # Draw light bands
                light_c = tuple(int(min(255, c * 1.15)) for c in rgb)
                draw.rectangle([0, y, w, y + 4], fill=(*light_c, 200))
                
        elif detail == 'bands':
            # Jupiter or Saturn gaseous bands
            for y in range(h):
                factor = 0.7 + 0.45 * math.sin(y * 0.08) + 0.15 * math.cos(y * 0.22)
                band_c = tuple(max(0, min(255, int(c * factor))) for c in rgb)
                draw.line([(0, y), (w, y)], fill=(*band_c, 255))
                
            # Jupiter Great Red Spot overlay
            if name == 'jupiter':
                draw.ellipse([int(w*0.65) - 30, 130 - 18, int(w*0.65) + 30, 130 + 18], fill=(210, 110, 80, 230))
                draw.ellipse([int(w*0.65) - 20, 130 - 12, int(w*0.65) + 20, 130 + 12], fill=(190, 45, 30, 255))
                
        elif detail == 'gas':
            # Uranus/Neptune faint bands
            for y in range(h):
                factor = 0.9 + 0.15 * math.sin(y * 0.04)
                band_c = tuple(max(0, min(255, int(c * factor))) for c in rgb)
                draw.line([(0, y), (w, y)], fill=(*band_c, 255))
                
        elif detail == 'earth_map':
            # Earth mapping: oceans blue, continents green/brown
            for x in range(w):
                for y in range(h):
                    # Simulating continent noise
                    nx = x * 0.035
                    ny = y * 0.05
                    val = math.sin(nx) + math.cos(ny) + math.sin(nx * 2.2 + ny * 1.5)
                    
                    if val > 0.45:
                        # Green land
                        g = int(100 + 40 * math.sin(nx))
                        img.putpixel((x, y), (45, g, 35, 255))
                    elif val > 0.15:
                        # Brown land
                        r = int(120 + 30 * math.cos(ny))
                        img.putpixel((x, y), (r, 100, 65, 255))
                    
            # Overlay swirling white clouds
            img_clouds = Image.new('RGBA', (w, h), (0, 0, 0, 0))
            draw_cl = ImageDraw.Draw(img_clouds)
            for _ in range(8):
                cx = random.randint(0, w)
                cy = random.randint(0, h)
                rw = random.randint(30, 110)
                rh = random.randint(10, 30)
                draw_cl.ellipse([cx - rw, cy - rh, cx + rw, cy + rh], fill=(255, 255, 255, 140))
            img_clouds = img_clouds.filter(ImageFilter.GaussianBlur(6))
            img = Image.alpha_composite(img, img_clouds)
            
        elif detail == 'mars_map':
            # Mars red, polar ice caps white, dark patches
            for x in range(w):
                for y in range(h):
                    # Polar cap at top and bottom
                    if y < 18 or y > h - 18:
                        img.putpixel((x, y), (250, 250, 255, 255))
                    else:
                        nx = x * 0.03
                        ny = y * 0.06
                        val = math.sin(nx) * math.cos(ny)
                        if val > 0.2:
                            # Darker red/brown patch
                            img.putpixel((x, y), (140, 50, 35, 255))
                            
        # Blur slightly to blend seams on texture load
        img = img.filter(ImageFilter.GaussianBlur(0.7))
        img.save(f'assets/planets/{name}.png', 'PNG')

# 5. Generate Rocket Ship graphics
def make_rocket():
    print("Generating rocket sprites...")
    # Rocket profile (Sleek spaceship)
    w, h = 256, 128
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Spaceship fuselage (pointing right)
    # Cockpit/Nose cone
    draw.polygon([(240, 64), (160, 42), (160, 86)], fill=(225, 235, 245, 255))
    # Body tube
    draw.rectangle([60, 42, 160, 86], fill=(195, 205, 220, 255))
    # Glass cabin window (visor)
    draw.polygon([(190, 64), (165, 48), (150, 48), (150, 64)], fill=(0, 220, 255, 255))
    
    # Engine booster block
    draw.rectangle([45, 46, 60, 82], fill=(110, 120, 135, 255))
    draw.polygon([(45, 52), (32, 56), (32, 72), (45, 76)], fill=(65, 70, 80, 255))
    
    # Back tail fin
    draw.polygon([(60, 42), (25, 12), (75, 42)], fill=(150, 40, 40, 255))
    draw.polygon([(60, 86), (25, 116), (75, 86)], fill=(150, 40, 40, 255))
    
    # Decal Stripe
    draw.rectangle([85, 60, 140, 68], fill=(0, 240, 255, 255))
    
    img.save('assets/rocket/rocket.png', 'PNG')

    # Rocket Engine Flame Glow
    img_glow = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
    draw_glow = ImageDraw.Draw(img_glow)
    
    # Inner booster fire
    for r in range(48, 0, -2):
        factor = r / 48.0
        # Color fades from white at center to bright orange/yellow to transparent at edges
        cr = 255
        cg = int(120 + 135 * (1.0 - factor))
        cb = int(40 * (1.0 - factor))
        ca = int(255 * (1.0 - factor)**1.6)
        draw_glow.ellipse([64 - r, 64 - r, 64 + r, 64 + r], fill=(cr, cg, cb, ca))
        
    img_glow = img_glow.filter(ImageFilter.GaussianBlur(3))
    img_glow.save('assets/rocket/rocket-glow.png', 'PNG')

# 6. Generate CosmoBot assistant robot
def make_cosmobot():
    print("Generating CosmoBot AI assistant sprite...")
    w, h = 256, 256
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = w // 2, h // 2
    r_body = 70
    
    # 1. Robotic head/body sphere (glowing cyan glass)
    # Glass shadow/glow ring
    draw.ellipse([cx - r_body - 4, cy - r_body - 4, cx + r_body + 4, cy + r_body + 4], fill=(0, 240, 255, 30))
    draw.ellipse([cx - r_body, cy - r_body, cx + r_body, cy + r_body], fill=(22, 28, 45, 230))
    
    # Face plate (dark blue visor)
    draw.ellipse([cx - 55, cy - 35, cx + 55, cy + 30], fill=(6, 8, 14, 255))
    
    # Glowing eyes (glowing cyan horizontal capsule shapes)
    draw.ellipse([cx - 36, cy - 12, cx - 12, cy + 6], fill=(0, 240, 255, 255))
    draw.ellipse([cx + 12, cy - 12, cx + 36, cy + 6], fill=(0, 240, 255, 255))
    
    # Reflection glow on head
    draw.ellipse([cx - 45, cy - 65, cx + 45, cy - 40], fill=(255, 255, 255, 38))
    
    # Antenna
    draw.line([(cx, cy - r_body), (cx, cy - r_body - 28)], fill=(120, 130, 145, 255), width=4)
    draw.ellipse([cx - 8, cy - r_body - 38, cx + 8, cy - r_body - 22], fill=(0, 240, 255, 255))
    
    # Robotic ears/plugs
    draw.rectangle([cx - r_body - 8, cy - 15, cx - r_body, cy + 15], fill=(120, 130, 145, 255))
    draw.rectangle([cx + r_body, cy - 15, cx + r_body + 8, cy + 15], fill=(120, 130, 145, 255))
    
    img = img.filter(ImageFilter.GaussianBlur(0.8))
    img.save('assets/ai/cosmobot.png', 'PNG')

def main():
    print("STARTING COSMOBOT PROCEDURAL ASSET GENERATION...")
    create_folders()
    make_starfield()
    make_nebula()
    make_wormhole()
    make_planets()
    make_rocket()
    make_cosmobot()
    print("ALL PROCEDURAL ASSETS CREATED SUCCESSFULLY!")

if __name__ == '__main__':
    main()
