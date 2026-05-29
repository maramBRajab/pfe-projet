package com.smartassign.pfe.dto;

public class ManagerNotificationDto {

    private Long id;
    private String titre;
    private String description;
    private String temps;
    private String type;        // IA | AFFECTATION | VIGILANCE | INFO | CRITIQUE
    private boolean lu;
    private String icon;        // ti-* icon name (without "ti " prefix)
    private String iconBg;      // icon-green | icon-blue | icon-amber | icon-red
    private String badgeClass;  // badge-ia | badge-affectation | badge-vigilance | badge-info | badge-critique

    public ManagerNotificationDto() {}

    public ManagerNotificationDto(Long id, String titre, String description, String temps,
                                  String type, boolean lu,
                                  String icon, String iconBg, String badgeClass) {
        this.id = id;
        this.titre = titre;
        this.description = description;
        this.temps = temps;
        this.type = type;
        this.lu = lu;
        this.icon = icon;
        this.iconBg = iconBg;
        this.badgeClass = badgeClass;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitre() { return titre; }
    public void setTitre(String titre) { this.titre = titre; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getTemps() { return temps; }
    public void setTemps(String temps) { this.temps = temps; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public boolean isLu() { return lu; }
    public void setLu(boolean lu) { this.lu = lu; }
    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }
    public String getIconBg() { return iconBg; }
    public void setIconBg(String iconBg) { this.iconBg = iconBg; }
    public String getBadgeClass() { return badgeClass; }
    public void setBadgeClass(String badgeClass) { this.badgeClass = badgeClass; }
}
