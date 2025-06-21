export interface SanitizedInput {
  value: string | number;
  isValid: boolean;
  errors: string[];
}

export interface ChannelFormData {
  name: string;
  type: string;
  position: number;
}

export class InputSanitizer {
  /**
   * Sanitise et valide le nom d'un channel Discord
   */
  static sanitizeChannelName(name: string): SanitizedInput {
    const errors: string[] = [];
    let sanitizedName = name;

    // Nettoie les espaces en début/fin
    sanitizedName = sanitizedName.trim();

    // Vérifie la longueur
    if (sanitizedName.length === 0) {
      errors.push("Le nom du channel ne peut pas être vide");
    } else if (sanitizedName.length > 100) {
      errors.push("Le nom du channel ne peut pas dépasser 100 caractères");
      sanitizedName = sanitizedName.substring(0, 100);
    }

    // Convertit en minuscules et remplace les espaces par des tirets
    sanitizedName = sanitizedName.toLowerCase();
    sanitizedName = sanitizedName.replace(/\s+/g, '-');

    // Supprime les caractères interdits pour Discord
    sanitizedName = sanitizedName.replace(/[^a-z0-9\-_]/g, '');

    // Assure qu'il ne commence/finit pas par un tiret
    sanitizedName = sanitizedName.replace(/^-+|-+$/g, '');

    // Évite les noms réservés
    const reservedNames = ['everyone', 'here', 'admin', 'mod', 'moderator'];
    if (reservedNames.includes(sanitizedName)) {
      errors.push("Ce nom de channel est réservé");
    }

    return {
      value: sanitizedName,
      isValid: errors.length === 0 && sanitizedName.length > 0,
      errors
    };
  }

  /**
   * Sanitise et valide le type de channel
   */
  static sanitizeChannelType(type: string): SanitizedInput {
    const errors: string[] = [];
    const sanitizedType = type.trim().toLowerCase();
    const validTypes = ['text', 'voice'];

    if (!validTypes.includes(sanitizedType)) {
      errors.push("Le type doit être 'text' ou 'voice'");
    }

    return {
      value: sanitizedType,
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitise et valide la position du channel
   */
  static sanitizeChannelPosition(position: string | number): SanitizedInput {
    const errors: string[] = [];
    let sanitizedPosition: number;

    if (typeof position === 'string') {
      // Nettoie les espaces
      const trimmed = position.trim();
      
      // Vérifie que c'est un nombre
      if (!/^\d+$/.test(trimmed)) {
        errors.push("La position doit être un nombre entier positif");
        sanitizedPosition = 0;
      } else {
        sanitizedPosition = parseInt(trimmed, 10);
      }
    } else {
      sanitizedPosition = position;
    }

    // Valide la plage
    if (sanitizedPosition < 0) {
      errors.push("La position ne peut pas être négative");
      sanitizedPosition = 0;
    } else if (sanitizedPosition > 999) {
      errors.push("La position ne peut pas dépasser 999");
      sanitizedPosition = 999;
    }

    return {
      value: sanitizedPosition,
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitise tous les champs d'un formulaire de création de channel
   */
  static sanitizeChannelForm(name: string, type: string, position: string | number): {
    sanitizedData: ChannelFormData;
    isValid: boolean;
    errors: string[];
  } {
    const nameResult = this.sanitizeChannelName(name);
    const typeResult = this.sanitizeChannelType(type);
    const positionResult = this.sanitizeChannelPosition(position);

    const allErrors = [
      ...nameResult.errors,
      ...typeResult.errors,
      ...positionResult.errors
    ];

    return {
      sanitizedData: {
        name: nameResult.value as string,
        type: typeResult.value as string,
        position: positionResult.value as number
      },
      isValid: nameResult.isValid && typeResult.isValid && positionResult.isValid,
      errors: allErrors
    };
  }
} 